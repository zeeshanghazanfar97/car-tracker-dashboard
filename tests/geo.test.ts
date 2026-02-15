import { describe, expect, it } from "vitest";
import { haversineMeters, parseLocationText, toGeoJsonLine } from "@/lib/geo";

describe("geo helpers", () => {
  it("parses postgres point format", () => {
    const parsed = parseLocationText("(46.6753,24.7136)");
    expect(parsed.warning).toBeNull();
    expect(parsed.point).toEqual({ lat: 24.7136, lon: 46.6753 });
  });

  it("parses WKT point format", () => {
    const parsed = parseLocationText("POINT(46.6753 24.7136)");
    expect(parsed.warning).toBeNull();
    expect(parsed.point).toEqual({ lat: 24.7136, lon: 46.6753 });
  });

  it("parses SRID WKT point format", () => {
    const parsed = parseLocationText("SRID=4326;POINT(46.6753 24.7136)");
    expect(parsed.warning).toBeNull();
    expect(parsed.point).toEqual({ lat: 24.7136, lon: 46.6753 });
  });

  it("parses GeoJSON point format", () => {
    const parsed = parseLocationText('{\"type\":\"Point\",\"coordinates\":[46.6753,24.7136]}');
    expect(parsed.warning).toBeNull();
    expect(parsed.point).toEqual({ lat: 24.7136, lon: 46.6753 });
  });

  it("calculates haversine distance", () => {
    const d = haversineMeters({ lat: 24.7136, lon: 46.6753 }, { lat: 24.7137, lon: 46.6754 });
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(20);
  });

  it("creates geojson line for point list", () => {
    const line = toGeoJsonLine([
      { lat: 24.7136, lon: 46.6753 },
      { lat: 24.7137, lon: 46.6754 }
    ]);

    expect(line?.geometry.type).toBe("LineString");
    expect(line?.geometry.coordinates.length).toBe(2);
  });
});
