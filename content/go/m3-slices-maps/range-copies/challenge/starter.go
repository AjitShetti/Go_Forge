package main

// Employee is one member of a team.
type Employee struct {
	Name  string
	Level int
}

// Promote raises the Level of every employee in team named name by one, in
// place, and reports whether anyone was promoted.
func Promote(team []Employee, name string) bool {
	found := false
	for _, e := range team {
		if e.Name == name {
			e.Level++
			found = true
		}
	}
	return found
}
