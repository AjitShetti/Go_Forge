package main

import (
	"fmt"
	"reflect"
)

type Router struct {
	handlers map[reflect.Type]func(any) string
}

func NewRouter() *Router {
	return &Router{handlers: map[reflect.Type]func(any) string{}}
}

// Refuses to replace an existing handler, so registering again changes nothing.
func Register[E any](r *Router, h func(E) string) {
	t := reflect.TypeFor[E]()
	if _, exists := r.handlers[t]; exists {
		return
	}
	r.handlers[t] = func(e any) string {
		return h(e.(E))
	}
}

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
