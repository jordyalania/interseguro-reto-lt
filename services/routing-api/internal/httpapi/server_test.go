package httpapi

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jordyalania/interseguro-reto-lt/services/routing-api/internal/auth"
)

const (
	testIssuer   = "endorsement-api"
	testAudience = "interseguro-reto"
	pdfRequest   = `{
		"accidentLocation": "San Isidro",
		"depots": ["Miraflores", "Ate"],
		"graph": {
			"Miraflores": { "San Isidro": 7, "Barranco": 3 },
			"San Isidro": { "Miraflores": 7, "Lince": 4 },
			"Barranco": { "Miraflores": 3, "Surco": 5 },
			"Lince": { "San Isidro": 4, "Surco": 6 },
			"Surco": { "Barranco": 5, "Lince": 6, "Ate": 10 },
			"Ate": { "Surco": 10 }
		}
	}`
)

type fixture struct {
	handler    http.Handler
	privateKey *rsa.PrivateKey
	publicPEM  []byte
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})
	verifier, err := auth.NewVerifier(publicPEM, testIssuer, testAudience)
	if err != nil {
		t.Fatal(err)
	}
	return fixture{
		handler:    NewHandler(verifier, slog.New(slog.NewTextHandler(io.Discard, nil))),
		privateKey: key,
		publicPEM:  publicPEM,
	}
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"sub": "demo",
		"iss": testIssuer,
		"aud": testAudience,
		"exp": time.Now().Add(time.Minute).Unix(),
	}
}

func (f fixture) token(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	signed, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(f.privateKey)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func (f fixture) post(body, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/api/v1/routes/optimal", strings.NewReader(body))
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	f.handler.ServeHTTP(response, request)
	return response
}

func TestOptimalRouteReturnsPDFExample(t *testing.T) {
	f := newFixture(t)

	response := f.post(pdfRequest, f.token(t, validClaims()))

	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body)
	}
	const want = `{"fromDepot":"Miraflores","to":"San Isidro","path":["Miraflores","San Isidro"],"distance":7}`
	if got := strings.TrimSpace(response.Body.String()); got != want {
		t.Errorf("obtuve %s, esperaba %s", got, want)
	}
}

func TestOptimalRouteErrors(t *testing.T) {
	f := newFixture(t)
	token := f.token(t, validClaims())

	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"inalcanzable", `{"accidentLocation":"C","depots":["A"],"graph":{"A":{"B":1},"B":{},"C":{}}}`, 422, "LOCATION_UNREACHABLE"},
		{"peso negativo", `{"accidentLocation":"B","depots":["A"],"graph":{"A":{"B":-1},"B":{}}}`, 400, "VALIDATION_ERROR"},
		{"base inexistente", `{"accidentLocation":"A","depots":["Z"],"graph":{"A":{}}}`, 400, "VALIDATION_ERROR"},
		{"JSON inválido", `{`, 400, "VALIDATION_ERROR"},
		{"campo desconocido", `{"accidentLocation":"A","depots":["A"],"graph":{"A":{}},"x":1}`, 400, "VALIDATION_ERROR"},
		{"dos objetos JSON", `{"accidentLocation":"A","depots":["A"],"graph":{"A":{}}}{}`, 400, "VALIDATION_ERROR"},
		{"cuerpo demasiado grande", `{"accidentLocation":"` + strings.Repeat("a", 1<<20) + `"}`, 413, "PAYLOAD_TOO_LARGE"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := f.post(tt.body, token)
			if response.Code != tt.wantStatus {
				t.Fatalf("status %d: %s", response.Code, response.Body)
			}
			var body errorResponse
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Code != tt.wantCode {
				t.Errorf("código %s, esperaba %s", body.Code, tt.wantCode)
			}
		})
	}
}

func TestOptimalRouteRejectsInvalidTokens(t *testing.T) {
	f := newFixture(t)

	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	forged, err := jwt.NewWithClaims(jwt.SigningMethodRS256, validClaims()).SignedString(otherKey)
	if err != nil {
		t.Fatal(err)
	}
	algorithmConfusion, err := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims()).SignedString(f.publicPEM)
	if err != nil {
		t.Fatal(err)
	}

	withClaim := func(key string, value any) jwt.MapClaims {
		claims := validClaims()
		claims[key] = value
		return claims
	}
	noExpiration := validClaims()
	delete(noExpiration, "exp")

	tests := map[string]string{
		"sin token":               "",
		"basura":                  "abc.def.ghi",
		"firmado con otra clave":  forged,
		"HS256 con clave pública": algorithmConfusion,
		"vencido":                 f.token(t, withClaim("exp", time.Now().Add(-time.Hour).Unix())),
		"otro emisor":             f.token(t, withClaim("iss", "otro")),
		"otra audiencia":          f.token(t, withClaim("aud", "otra")),
		"sin vencimiento":         f.token(t, noExpiration),
	}

	for name, token := range tests {
		t.Run(name, func(t *testing.T) {
			if response := f.post(pdfRequest, token); response.Code != http.StatusUnauthorized {
				t.Errorf("status %d, esperaba 401", response.Code)
			}
		})
	}
}

func TestHealthDoesNotRequireToken(t *testing.T) {
	f := newFixture(t)
	response := httptest.NewRecorder()

	f.handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health", nil))

	if response.Code != http.StatusOK {
		t.Errorf("status %d", response.Code)
	}
}
