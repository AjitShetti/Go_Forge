package main

import (
	"fmt"
	"reflect"
)

// Keys handlers by reflect.Kind ("struct", "int", ...) instead of by type, so
// every struct event goes to whichever struct handler was registered last.
type Router struct {
	handlers map[reflect.Kind]func(any) string
}

func NewRouter() *Router {
	return &Router{handlers: map[reflect.Kind]func(any) string{}}
}

func Register[E any](r *Router, h func(E) string) {
	r.handlers[reflect.TypeFor[E]().Kind()] = func(e any) string {
		ev, ok := e.(E)
		if !ok {
			return fmt.Sprintf("wrong handler for %T", e)
		}
		return h(ev)
	}
}

func (r *Router) Dispatch(events []any) []string {
	out := make([]string, len(events))
	for i, e := range events {
		t := reflect.TypeOf(e)
		if t == nil {
			out[i] = "unhandled <nil>"
			continue
		}
		if h, ok := r.handlers[t.Kind()]; ok {
			out[i] = h(e)
		} else {
			out[i] = fmt.Sprintf("unhandled %T", e)
		}
	}
	return out
}
