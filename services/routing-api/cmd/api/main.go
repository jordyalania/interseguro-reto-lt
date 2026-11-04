package main

import (
	"context"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jordyalania/interseguro-reto-lt/services/routing-api/internal/auth"
	"github.com/jordyalania/interseguro-reto-lt/services/routing-api/internal/httpapi"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "comprueba /health y termina")
	flag.Parse()

	port := getenv("PORT", "3002")
	if *healthcheck {
		// La imagen final no tiene shell ni curl: el propio binario hace la comprobación.
		os.Exit(runHealthcheck(port))
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(port, logger); err != nil {
		logger.Error("el servicio terminó con error", "error", err)
		os.Exit(1)
	}
}

func run(port string, logger *slog.Logger) error {
	publicKey, err := base64.StdEncoding.DecodeString(os.Getenv("JWT_PUBLIC_KEY_B64"))
	if err != nil {
		return fmt.Errorf("JWT_PUBLIC_KEY_B64 inválida: %w", err)
	}
	verifier, err := auth.NewVerifier(
		publicKey,
		getenv("JWT_ISSUER", "endorsement-api"),
		getenv("JWT_AUDIENCE", "interseguro-reto"),
	)
	if err != nil {
		return err
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.NewHandler(verifier, logger),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	listenErrors := make(chan error, 1)
	go func() {
		logger.Info("routing-api escuchando", "port", port)
		listenErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-listenErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}

func runHealthcheck(port string) int {
	client := http.Client{Timeout: 2 * time.Second}
	response, err := client.Get("http://127.0.0.1:" + port + "/health")
	if err != nil {
		return 1
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func getenv(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
