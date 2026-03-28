package main

import (
	"encoding/json"
	"net/http"

	"github.com/stripe/stripe-go/v76"
)

func handlePayment(w http.ResponseWriter, r *http.Request) {
	params := &stripe.ChargeParams{}
	params.Amount = stripe.Int64(1000)
	params.Currency = stripe.String("usd")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "processed"})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
