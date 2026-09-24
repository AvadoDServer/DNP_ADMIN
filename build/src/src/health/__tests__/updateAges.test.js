import { trackUpdateAges } from "health/updateAges";

describe("trackUpdateAges", () => {
  const NOW = 1790000000000;
  it("starts the clock when an update appears and keeps it while it stays", () => {
    const a = trackUpdateAges(null, { x: { from: "1.0.0", to: "1.1.0" } }, NOW);
    expect(a).toEqual({ x: NOW });
    const b = trackUpdateAges(a, { x: { from: "1.0.0", to: "1.2.0" } }, NOW + 5000);
    expect(b).toEqual({ x: NOW }); // a newer target does not restart the clock
  });
  it("forgets an update once it is installed", () => {
    expect(trackUpdateAges({ x: NOW }, {}, NOW + 1)).toEqual({});
  });
  it("keeps the previous ages when the store could not be read", () => {
    expect(trackUpdateAges({ x: NOW }, null, NOW + 1)).toEqual({ x: NOW });
    expect(trackUpdateAges(null, null, NOW)).toBeNull();
  });
});
