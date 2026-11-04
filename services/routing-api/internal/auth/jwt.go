// Package auth verifica los JWT emitidos por endorsement-api. Este servicio solo tiene la
// clave pública: puede comprobar tokens, pero no puede emitirlos.
package auth

import (
	"crypto/rsa"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// Verifier comprueba firma, algoritmo, emisor, audiencia y vencimiento.
type Verifier struct {
	publicKey *rsa.PublicKey
	parser    *jwt.Parser
}

// NewVerifier crea un Verifier a partir de una clave pública en formato PEM.
func NewVerifier(publicKeyPEM []byte, issuer, audience string) (*Verifier, error) {
	key, err := jwt.ParseRSAPublicKeyFromPEM(publicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("clave pública inválida: %w", err)
	}
	return &Verifier{
		publicKey: key,
		parser: jwt.NewParser(
			// Fijar el algoritmo evita que alguien firme con HS256 usando la clave pública.
			jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
			jwt.WithIssuer(issuer),
			jwt.WithAudience(audience),
			jwt.WithExpirationRequired(),
		),
	}, nil
}

// Verify devuelve un error si el token no es válido.
func (v *Verifier) Verify(token string) error {
	_, err := v.parser.Parse(token, func(*jwt.Token) (any, error) {
		return v.publicKey, nil
	})
	return err
}
