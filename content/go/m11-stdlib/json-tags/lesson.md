---
{
  "slug": "json-tags",
  "title": "encoding/json and struct tags",
  "concepts": ["encoding-json"],
  "requires": [],
  "trap": {
    "concept": "encoding-json",
    "question": "User has four tagged fields: name, email (lowercase field), age with omitempty set to 0, and Admin tagged \"-\" set to true. What does json.Marshal produce?",
    "kind": "choice",
    "choices": [
      "{\"name\":\"Ana\",\"email\":\"ana@example.com\",\"age\":0} <nil>",
      "{\"name\":\"Ana\",\"email\":\"ana@example.com\"} <nil>",
      "{\"name\":\"Ana\"} <nil>",
      "{\"name\":\"Ana\",\"age\":0,\"Admin\":true} <nil>"
    ],
    "answer": 2
  },
  "rebuild": {
    "goal": "Make it print `<nil>` and then `id=42 tags=2`. main (lines 8–13) is locked.",
    "lockedLines": [8, 9, 10, 11, 12, 13]
  },
  "challenge": {
    "prompt": "Make `Order` encode as `{\"id\",\"total_cents\",\"status\":\"paid\",\"note\"}` with note omitted when empty, give `Status` string JSON both ways, and make `DecodeOrder` reject unknown fields.",
    "entry": "starter.go"
  }
}
---

## Provoke

`User` has a tag on every field. One field name starts with a lowercase letter, `Age` is `0` with `omitempty`, and `Admin` is tagged `"-"`.

## Decode

### encoding/json only sees what reflection can see

`json.Marshal` has no special access to your struct. It uses package `reflect` to walk the fields at runtime, and reflection follows Go's visibility rule: **a lowercase field is unexported**, so code outside your package, including `encoding/json`, can't read or set it. The tag on `email` is never even looked at. No error, no warning from the compiler (`go vet`'s `structtag` check does catch it).

A struct tag is just a string attached to a field: `` `json:"age,omitempty"` ``. The compiler stores it, and packages read it with `reflect.StructTag.Get("json")`. The `json` package understands:

- a name: `"age"` is the key in JSON. Without a tag, the field name is used as is.
- `omitempty`: skip the field when it holds its zero value (`0`, `""`, `false`, `nil`, empty slice or map). A struct is never "empty" for this purpose; `omitzero` (Go 1.24) handles structs and types with an `IsZero` method.
- `"-"`: never encode or decode this field.
- `string`: encode a number or bool as a JSON string.

So the output is `{"name":"Ana"}`: `email` is invisible, `age` is zero and omitted, and `Admin` is excluded.

### Decoding is forgiving by default

- Keys match field names **case-insensitively** when there's no exact match.
- **Unknown keys are ignored.** A typo in a request (`"totl_cents"`) silently leaves your field at zero. `json.Decoder` with `DisallowUnknownFields()` turns that into an error.
- Decoding into `any` has no type to aim for, so JSON objects become `map[string]any`, arrays `[]any`, and **every number a `float64`**, large integers losing precision included. That's the Rebuild. Decode into a struct when you know the shape, or use `Decoder.UseNumber()`.

```go verified id=decode-rules
package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

type Point struct {
	X int `json:"x"`
	Y int
}

func main() {
	var p Point
	err := json.Unmarshal([]byte(`{"X": 1, "y": 2, "z": 3}`), &p)
	fmt.Printf("%+v %v\n", p, err)

	dec := json.NewDecoder(strings.NewReader(`{"x": 1, "z": 3}`))
	dec.DisallowUnknownFields()
	var q Point
	fmt.Println(dec.Decode(&q))

	var anything any
	json.Unmarshal([]byte(`{"n": 12345678901234567890, "list": [1, "two", null]}`), &anything)
	fmt.Printf("%#v\n", anything)
}
```

### Taking over a type's encoding

A type that implements `json.Marshaler` (`MarshalJSON() ([]byte, error)`) or `json.Unmarshaler` (`UnmarshalJSON([]byte) error`) controls its own JSON. Two details decide whether it works:

- The bytes are **raw JSON**. `MarshalJSON` for a string value must return `"paid"` with the quotes. The easy way is `json.Marshal(name)`.
- `UnmarshalJSON` must have a **pointer receiver**, because it has to change the value being decoded. With a value receiver the decoder still calls it (M4: `*T`'s method set includes `T`'s methods), and it quietly sets a copy.

## Python/JS contrast

- **Python**: `json.dumps(obj.__dict__)` includes everything, "private" `_fields` too, since Python has no enforced visibility. Pydantic's `Field(alias="total_cents")` and `exclude=True` are Go's tag options, and its `extra="forbid"` is `DisallowUnknownFields`. Python's `json.loads` keeps integers as `int`, so the float trap doesn't exist there.
- **JavaScript**: `JSON.parse` turns every number into a double, like Go's `any` decoding, and big IDs lose digits. `toJSON()` is `MarshalJSON`.
- **False friend:** a tag looks like it makes a field part of the JSON. Only an **exported** field with a tag is part of the JSON.

## Rebuild

`describe` gets a payload decoded into `map[string]any` and asserts the id is an `int`. `main` is locked.

## Challenge

`Order` needs the exact JSON shape an API expects. The hidden tests marshal orders and compare the exact bytes, check that an empty note is omitted, decode, round-trip all three statuses, and require errors for an unknown status and for a misspelled field.

## Stretch

Add `CreatedAt time.Time` to `Order`, marshal it, and read the format (RFC 3339 with nanoseconds). Then add a `Discount *int64` with `omitempty`: what's the JSON difference between "no discount" (nil) and "discount of 0" (pointer to 0), and why do APIs use pointer fields for exactly that?
