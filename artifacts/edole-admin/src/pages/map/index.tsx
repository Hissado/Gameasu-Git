import React from "react";
import { useListEquipment, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";

// Fix par défaut des icônes leaflet (URL relative cassée par Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Coordonnées approximatives Abidjan (centre par défaut)
const DEFAULT_CENTER: [number, number] = [5.36, -4.0083];

// Mapping de villes connues vers coordonnées (à enrichir au besoin)
const CITY_COORDS: Record<string, [number, number]> = {
  abidjan: [5.36, -4.0083],
  yamoussoukro: [6.827, -5.2893],
  bouaké: [7.69, -5.03],
  bouake: [7.69, -5.03],
  daloa: [6.877, -6.45],
  korhogo: [9.4577, -5.6296],
  "san-pedro": [4.7485, -6.6363],
  "san pedro": [4.7485, -6.6363],
  cocody: [5.36, -3.99],
  marcory: [5.302, -3.984],
  treichville: [5.295, -4.005],
  yopougon: [5.336, -4.087],
  plateau: [5.323, -4.022],
};

function locationToCoord(loc?: string | null): [number, number] | null {
  if (!loc) return null;
  const key = loc.toLowerCase().trim();
  for (const [city, coord] of Object.entries(CITY_COORDS)) {
    if (key.includes(city)) {
      // Légère dispersion pour éviter superposition
      const jitter = () => (Math.random() - 0.5) * 0.02;
      return [coord[0] + jitter(), coord[1] + jitter()];
    }
  }
  return null;
}

export default function MapPage() {
  const { data: equipment } = useListEquipment();
  const { data: projects } = useListProjects();

  const equipmentMarkers = (equipment?.data || [])
    .map((e) => ({ ...e, coord: locationToCoord(e.location) }))
    .filter((e) => e.coord);

  const projectMarkers = (projects?.data || [])
    .map((p: any) => ({ ...p, coord: locationToCoord(p.description) }))
    .filter((p) => p.coord);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carte des opérations</h1>
          <p className="text-sm text-muted-foreground mt-1">Localisation géographique du matériel sur les chantiers actifs.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary" /> Équipement</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> Chantier</span>
        </div>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Vue géographique</CardTitle>
          <CardDescription>{equipmentMarkers.length} équipement(s) localisé(s) — {projectMarkers.length} chantier(s) cartographié(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div style={{ height: "560px" }}>
            <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {projectMarkers.map((p) => (
                <Marker key={`proj-${p.id}`} position={p.coord!}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-bold">{p.name}</div>
                      <div className="text-xs text-slate-600">Chantier — {p.clientName || "Client interne"}</div>
                      <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {equipmentMarkers.map((e) => (
                <CircleMarker
                  key={`eq-${e.id}`}
                  center={e.coord!}
                  radius={8}
                  pathOptions={{ color: "#F26B1F", fillColor: "#F26B1F", fillOpacity: 0.7 }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-bold">{e.name}</div>
                      <div className="text-xs font-mono text-slate-600">{e.code}</div>
                      <div className="text-xs text-slate-600">📍 {e.location}</div>
                      <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {equipmentMarkers.length === 0 && projectMarkers.length === 0 && (
        <Card className="shadow-sm border-border">
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun équipement ni chantier n'a de localisation reconnaissable.</p>
            <p className="text-xs text-muted-foreground mt-1">Renseignez le champ « Localisation » avec une ville ivoirienne (Abidjan, Bouaké, Yamoussoukro…).</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
