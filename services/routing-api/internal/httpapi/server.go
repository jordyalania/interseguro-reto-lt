// Package httpapi expone el cálculo de rutas por HTTP.
package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jordyalania/interseguro-reto-lt/services/routing-api/internal/graph"
)

const maxBodyBytes = 1 << 20 // 1 MiB

// TokenVerifier es lo único que el servidor necesita saber de la autenticación.
type TokenVerifier interface {
	Verify(token string) error
}

type optimalRouteRequest struct {
	AccidentLocation string      `json:"accidentLocation"`
	Depots           []string    `json:"depots"`
	Graph            graph.Graph `json:"graph"`
}

type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewHandler construye el enrutador con sus middlewares.
func NewHandler(verifier TokenVerifier, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.Handle("POST /api/v1/routes/optimal", requireToken(verifier, http.HandlerFunc(optimalRoute)))
	return logRequests(logger, mux)
}

func optimalRoute(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	var request optimalRouteRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "El cuerpo supera el límite permitido")
			return
		}
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "JSON inválido: "+err.Error())
		return
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "El cuerpo debe contener un único objeto JSON")
		return
	}

	route, err := graph.FindNearest(request.Graph, request.AccidentLocation, request.Depots)
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, route)
	case errors.Is(err, graph.ErrUnreachable):
		writeError(w, http.StatusUnprocessableEntity, "LOCATION_UNREACHABLE", err.Error())
	case errors.Is(err, graph.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Error interno")
	}
}

func requireToken(verifier TokenVerifier, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, found := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !found || verifier.Verify(token) != nil {
			w.Header().Set("WWW-Authenticate", "Bearer")
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Token ausente o inválido")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		if r.URL.Path == "/health" {
			return
		}
		logger.Info("solicitud",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"durationMs", time.Since(start).Milliseconds(),
			"requestId", r.Header.Get("X-Request-Id"),
		)
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Code: code, Message: message})
}
