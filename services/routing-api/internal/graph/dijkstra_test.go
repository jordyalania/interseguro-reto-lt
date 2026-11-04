package graph

import (
	"errors"
	"fmt"
	"math"
	"reflect"
	"testing"
)

var limaGraph = Graph{
	"Miraflores": {"San Isidro": 7, "Barranco": 3},
	"San Isidro": {"Miraflores": 7, "Lince": 4},
	"Barranco":   {"Miraflores": 3, "Surco": 5},
	"Lince":      {"San Isidro": 4, "Surco": 6},
	"Surco":      {"Barranco": 5, "Lince": 6, "Ate": 10},
	"Ate":        {"Surco": 10},
}

func TestFindNearest(t *testing.T) {
	tests := []struct {
		name     string
		graph    Graph
		accident string
		depots   []string
		want     Route
	}{
		{
			name:     "ejemplo del PDF",
			graph:    limaGraph,
			accident: "San Isidro",
			depots:   []string{"Miraflores", "Ate"},
			want:     Route{"Miraflores", "San Isidro", []string{"Miraflores", "San Isidro"}, 7},
		},
		{
			name:     "elige la base que no es la primera de la lista",
			graph:    limaGraph,
			accident: "Surco",
			depots:   []string{"Ate", "Barranco"},
			want:     Route{"Barranco", "Surco", []string{"Barranco", "Surco"}, 5},
		},
		{
			name:     "prefiere una ruta larga en tramos pero más corta en distancia",
			graph:    Graph{"A": {"B": 1, "D": 10}, "B": {"C": 1}, "C": {"D": 1}, "D": {}},
			accident: "D",
			depots:   []string{"A"},
			want:     Route{"A", "D", []string{"A", "B", "C", "D"}, 3},
		},
		{
			name:     "la base está en el lugar del siniestro",
			graph:    limaGraph,
			accident: "Ate",
			depots:   []string{"Miraflores", "Ate"},
			want:     Route{"Ate", "Ate", []string{"Ate"}, 0},
		},
		{
			name:     "empate entre bases se resuelve alfabéticamente",
			graph:    Graph{"Zeta": {"X": 5}, "Alfa": {"X": 5}, "X": {}},
			accident: "X",
			depots:   []string{"Zeta", "Alfa"},
			want:     Route{"Alfa", "X", []string{"Alfa", "X"}, 5},
		},
		{
			name:     "respeta el sentido de las aristas",
			graph:    Graph{"A": {"B": 1}, "B": {}, "C": {"B": 9}},
			accident: "B",
			depots:   []string{"A", "C"},
			want:     Route{"A", "B", []string{"A", "B"}, 1},
		},
		{
			name:     "acepta un destino que solo aparece como vecino",
			graph:    Graph{"A": {"Nuevo": 2}},
			accident: "Nuevo",
			depots:   []string{"A"},
			want:     Route{"A", "Nuevo", []string{"A", "Nuevo"}, 2},
		},
		{
			name:     "acepta distancias decimales",
			graph:    Graph{"A": {"B": 1.5}, "B": {"C": 2.25}, "C": {}},
			accident: "C",
			depots:   []string{"A"},
			want:     Route{"A", "C", []string{"A", "B", "C"}, 3.75},
		},
		{
			name:     "acepta aristas de distancia cero",
			graph:    Graph{"A": {"B": 0}, "B": {"C": 0}, "C": {}},
			accident: "C",
			depots:   []string{"A"},
			want:     Route{"A", "C", []string{"A", "B", "C"}, 0},
		},
		{
			name:     "ignora bases repetidas",
			graph:    limaGraph,
			accident: "Lince",
			depots:   []string{"Surco", "Surco"},
			want:     Route{"Surco", "Lince", []string{"Surco", "Lince"}, 6},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := FindNearest(tt.graph, tt.accident, tt.depots)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("obtuve %+v, esperaba %+v", got, tt.want)
			}
		})
	}
}

func TestFindNearestErrors(t *testing.T) {
	tests := []struct {
		name     string
		graph    Graph
		accident string
		depots   []string
		want     error
	}{
		{"siniestro inalcanzable", Graph{"A": {"B": 1}, "B": {}, "C": {}}, "C", []string{"A"}, ErrUnreachable},
		{"arista en sentido contrario", Graph{"A": {"B": 1}, "B": {}}, "A", []string{"B"}, ErrUnreachable},
		{"grafo vacío", Graph{}, "A", []string{"A"}, ErrInvalidInput},
		{"accidente vacío", limaGraph, "", []string{"Ate"}, ErrInvalidInput},
		{"accidente desconocido", limaGraph, "Cusco", []string{"Ate"}, ErrInvalidInput},
		{"sin bases", limaGraph, "Ate", nil, ErrInvalidInput},
		{"base desconocida", limaGraph, "Ate", []string{"Cusco"}, ErrInvalidInput},
		{"distancia negativa", Graph{"A": {"B": -1}, "B": {}}, "B", []string{"A"}, ErrInvalidInput},
		{"distancia infinita", Graph{"A": {"B": math.Inf(1)}, "B": {}}, "B", []string{"A"}, ErrInvalidInput},
		{"nodo sin nombre", Graph{"": {"B": 1}, "B": {}}, "B", []string{"B"}, ErrInvalidInput},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := FindNearest(tt.graph, tt.accident, tt.depots); !errors.Is(err, tt.want) {
				t.Errorf("obtuve %v, esperaba %v", err, tt.want)
			}
		})
	}
}

// El orden de iteración de los mapas de Go es aleatorio; la respuesta no debe depender de él.
func TestFindNearestIsDeterministic(t *testing.T) {
	g := Graph{"A": {"B": 1, "C": 1}, "B": {"D": 1}, "C": {"D": 1}, "D": {}}
	first, err := FindNearest(g, "D", []string{"A"})
	if err != nil {
		t.Fatal(err)
	}
	for range 200 {
		got, err := FindNearest(g, "D", []string{"A"})
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, first) {
			t.Fatalf("resultado distinto: %+v y %+v", got, first)
		}
	}
}

func TestFindNearestDoesNotModifyInput(t *testing.T) {
	depots := []string{"Ate", "Miraflores", "Ate"}
	if _, err := FindNearest(limaGraph, "San Isidro", depots); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(depots, []string{"Ate", "Miraflores", "Ate"}) {
		t.Errorf("modificó las bases recibidas: %v", depots)
	}
}

func gridGraph(size int) Graph {
	g := make(Graph, size*size)
	for row := range size {
		for col := range size {
			neighbors := map[string]float64{}
			if row+1 < size {
				neighbors[fmt.Sprintf("%d-%d", row+1, col)] = float64((row*col)%7 + 1)
			}
			if col+1 < size {
				neighbors[fmt.Sprintf("%d-%d", row, col+1)] = float64((row+col)%5 + 1)
			}
			g[fmt.Sprintf("%d-%d", row, col)] = neighbors
		}
	}
	return g
}

func BenchmarkFindNearest(b *testing.B) {
	for _, size := range []int{10, 100} {
		g := gridGraph(size)
		target := fmt.Sprintf("%d-%d", size-1, size-1)
		b.Run(fmt.Sprintf("nodos=%d", size*size), func(b *testing.B) {
			for b.Loop() {
				if _, err := FindNearest(g, target, []string{"0-0"}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}
