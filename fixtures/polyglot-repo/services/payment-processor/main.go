package main

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/payments/process", handlePayment).Methods("POST")
	r.HandleFunc("/health", handleHealth).Methods("GET")

	fmt.Println("Payment processor listening on :8080")
	http.ListenAndServe(":8080", r)
}
