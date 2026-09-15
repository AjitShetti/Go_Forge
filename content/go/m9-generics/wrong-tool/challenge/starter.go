package main

import "fmt"

// Router sends each event to the handler registered for its exact dynamic
// type.
type Router struct {
	handlers map[string]func(any) string
}

func NewRouter() *Router {
	return &Router{handlers: map[string]func(any) string{}}
}

// Register adds a type-safe handler for events of exactly type E, replacing
// any earlier handler for E. The tests call it as Register(r, handler).
func (r *Router) Register[E any](h func(E) string) {
	r.handlers[fmt.Sprintf("%T", *new(E))] = func(e any) string { return h(e.(E)) }
}

// Dispatch calls the matching handler for each event, in order. An event with
// no handler (including nil) produces "unhandled " + its %T.
func (r *Router) Dispatch(events []any) []string {
	return nil
}
