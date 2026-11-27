/** Sample data for trying tableflip out, shaped like a spreadsheet paste. */
export const EXAMPLE_TABLE = [
  ["Tag", "Description", "Range", "Units", "Signal", "Terminal"],
  ["FT-101", "Feed water flow", "0-250", "GPM", "4-20 mA", "1-2"],
  ["PT-102", "Boiler drum pressure", "0-600", "psig", "4-20 mA", "1-3"],
  ["TT-103", "Steam temperature", "50-900", "°F", "RTD", "1-4"],
  ["LT-104", "Drum level", "-15-15", "in. WC", "4-20 mA", "1-5"],
  ["ZSO-105", "Feed valve open", "", "", "24 VDC", "2-1"],
  ["FV-106", "Feed control valve", "0-100", "%", "4-20 mA", "2-2"],
]
  .map((row) => row.join("\t"))
  .join("\n")
