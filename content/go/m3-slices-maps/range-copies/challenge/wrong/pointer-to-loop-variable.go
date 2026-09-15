package main

type Employee struct {
	Name  string
	Level int
}

// &e is the address of the loop's copy, not of the slice element.
func Promote(team []Employee, name string) bool {
	found := false
	for _, e := range team {
		p := &e
		if p.Name == name {
			p.Level++
			found = true
		}
	}
	return found
}
