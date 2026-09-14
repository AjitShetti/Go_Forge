package main

import "fmt"

type Weekday int

const (
	Sunday Weekday = iota
	Monday
	Tuesday
)

func (d Weekday) String() string { return [...]string{"Sun", "Mon", "Tue"}[d] }

func describe(v any) string {
	switch x := v.(type) {
	case int:
		return fmt.Sprintf("int %d", x)
	case string:
		return "string " + x
	case fmt.Stringer:
		return "stringer " + x.String()
	default:
		return fmt.Sprintf("other %T", x)
	}
}

func main() {
	fmt.Println(describe(1), describe("s"), describe(Tuesday), describe(2.5))
	fmt.Println(Monday)
}
