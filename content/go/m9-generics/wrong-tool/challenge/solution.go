package main

import (
	"fmt"
	"reflect"
)

// Router sends each event to the handler registered for its exact dynamic
// type.
//
// Inside, it's not generic at all: one map from a runtime type to a handler
// that takes any. A generic Router[E] could only hold one event type.
type Router struct {
	handlers map[reflect.Type]func(any) string
}

func NewRouter() *Router {
	return &Router{handlers: map[reflect.Type]func(any) string{}}
}

// Register adds a type-safe handler for events of exactly type E, replacing
// any earlier handler for E. The tests call it as Register(r, handler).
//
// Methods can't have type parameters, so the generic part is a function. It
// sits at the edge of the API, where it gives callers a typed handler, and
// converts it to the untyped form the Router stores.
func Register[E any](r *Router, h func(E) string) {
	r.handlers[reflect.TypeFor[E]()] = func(e any) string {
		return h(e.(E))
	}
}

// Dispatch calls the matching handler for each event, in order. An event with
// no handler (including nil) produces "unhandled " + its %T.
func (r *Router) Dispatch(events []any) []string {
	out := make([]string, len(events))
	for i, e := range events {
		if h, ok := r.handlers[reflect.TypeOf(e)]; ok {
			out[i] = h(e)
		} else {
			out[i] = fmt.Sprintf("unhandled %T", e)
		}
	}
	return out
}
