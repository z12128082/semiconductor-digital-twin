// Procedurally generates the bundled IFC samples:
//   - fab-building.ifc        main fab: cleanroom level + sub-fab utility level
//   - fab-support-annex.ifc   central utility building that federates beside it
//
// Every element is an IFC4 IfcTriangulatedFaceSet box, following the exact
// entity pattern of the original bundled sample that web-ifc is known to
// parse. Deterministic output: run `node scripts/generate-fab-ifc.mjs`
// whenever the layout changes and commit the resulting files.

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets/ifc')

const GUID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'

function makeGuidFactory(seedText) {
  let counter = 0
  return () => {
    counter += 1
    // deterministic 22-char pseudo GUID (first char kept in 0..3 per spec)
    let hash = 2166136261 >>> 0
    const text = `${seedText}:${counter}`
    for (let i = 0; i < text.length; i++) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0
    }
    let guid = GUID_ALPHABET[hash % 4]
    let value = hash
    for (let i = 1; i < 22; i++) {
      value = Math.imul(value ^ (counter + i), 2654435761) >>> 0
      guid += GUID_ALPHABET[value % 64]
    }
    return guid
  }
}

const fmt = (n) => {
  const rounded = Math.round(n * 1000) / 1000
  const text = String(rounded)
  return text.includes('.') || text.includes('e') ? text : `${text}.`
}

class IfcWriter {
  constructor(fileName, projectName, buildingName, guidSeed) {
    this.lines = []
    this.id = 100
    this.fileName = fileName
    this.guid = makeGuidFactory(guidSeed)
    this.storeyPlacements = new Map()
    this.storeyIds = new Map()
    this.elementsByStorey = new Map()

    this.push(`#12= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`)
    this.push(`#36= IFCUNITASSIGNMENT((#12));`)
    this.push(`#38= IFCCARTESIANPOINT((0.,0.,0.));`)
    this.push(`#39= IFCAXIS2PLACEMENT3D(#38,$,$);`)
    this.push(
      `#40= IFCGEOMETRICREPRESENTATIONCONTEXT('3D','Model',3,1.0E-05,#39,$);`,
    )
    this.push(
      `#41= IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#40,$,.MODEL_VIEW.,$);`,
    )
    this.push(
      `#37= IFCPROJECT('${this.guid()}',$,'${projectName}',$,$,$,$,(#40),#36);`,
    )
    this.push(`#67= IFCLOCALPLACEMENT($,#39);`)
    this.push(
      `#44= IFCSITE('${this.guid()}',$,'Fab Campus Site',$,$,#67,$,$,.ELEMENT.,$,$,$,$,$);`,
    )
    this.push(`#45= IFCRELAGGREGATES('${this.guid()}',$,$,$,#37,(#44));`)
    this.buildingId = this.next()
    this.push(
      `#${this.buildingId}= IFCBUILDING('${this.guid()}',$,'${buildingName}',$,$,#67,$,$,.ELEMENT.,$,$,$);`,
    )
    this.push(
      `#${this.next()}= IFCRELAGGREGATES('${this.guid()}',$,$,$,#44,(#${this.buildingId}));`,
    )
  }

  next() {
    this.id += 1
    return this.id
  }

  push(line) {
    this.lines.push(line)
  }

  addStorey(name, elevation) {
    const storeyId = this.next()
    this.push(
      `#${storeyId}= IFCBUILDINGSTOREY('${this.guid()}',$,'${name}',$,$,#67,$,$,.ELEMENT.,${fmt(elevation)});`,
    )
    this.storeyIds.set(name, storeyId)
    this.elementsByStorey.set(name, [])
    return name
  }

  // Axis-aligned box: centred at (cx, cy), from zBase to zBase + h.
  addBox(storey, type, name, cx, cy, zBase, sx, sy, h, predefined) {
    const x = sx / 2
    const y = sy / 2
    const points = [
      [-x, y, 0], [-x, -y, 0], [x, -y, 0], [x, y, 0],
      [-x, y, h], [-x, -y, h], [x, -y, h], [x, y, h],
      [-x, y, 0], [-x, -y, 0], [-x, -y, h], [-x, y, h],
      [-x, -y, 0], [x, -y, 0], [x, -y, h], [-x, -y, h],
      [x, -y, 0], [x, y, 0], [x, y, h], [x, -y, h],
      [x, y, 0], [-x, y, 0], [-x, y, h], [x, y, h],
    ]
    const normals = [
      [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
      [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
      [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0],
      [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0],
      [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0],
      [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0],
    ]
    const indices =
      '((1,3,2),(1,4,3),(5,6,7),(5,7,8),(9,10,11),(9,11,12),(13,14,15),(13,15,16),(17,18,19),(17,19,20),(21,22,23),(21,23,24))'

    const pointListId = this.next()
    this.push(
      `#${pointListId}= IFCCARTESIANPOINTLIST3D((${points
        .map((p) => `(${p.map(fmt).join(',')})`)
        .join(',')}));`,
    )
    const faceSetId = this.next()
    this.push(
      `#${faceSetId}= IFCTRIANGULATEDFACESET(#${pointListId},(${normals
        .map((n) => `(${n.map(fmt).join(',')})`)
        .join(',')}),.T.,${indices},$);`,
    )
    const shapeRepId = this.next()
    this.push(
      `#${shapeRepId}= IFCSHAPEREPRESENTATION(#41,'Body','Tessellation',(#${faceSetId}));`,
    )
    const shapeId = this.next()
    this.push(`#${shapeId}= IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`)
    const originId = this.next()
    this.push(
      `#${originId}= IFCCARTESIANPOINT((${fmt(cx)},${fmt(cy)},${fmt(zBase)}));`,
    )
    const axisId = this.next()
    this.push(`#${axisId}= IFCAXIS2PLACEMENT3D(#${originId},$,$);`)
    const placementId = this.next()
    this.push(`#${placementId}= IFCLOCALPLACEMENT(#67,#${axisId});`)
    const elementId = this.next()
    const predefinedText = predefined ? `.${predefined}.` : '$'
    this.push(
      `#${elementId}= ${type}('${this.guid()}',$,'${name}',$,$,#${placementId},#${shapeId},$,${predefinedText});`,
    )
    this.elementsByStorey.get(storey).push(elementId)
  }

  toString() {
    const relLines = []
    for (const [storey, elementIds] of this.elementsByStorey) {
      if (elementIds.length === 0) continue
      const storeyId = this.storeyIds.get(storey)
      relLines.push(
        `#${this.next()}= IFCRELCONTAINEDINSPATIALSTRUCTURE('${this.guid()}',$,$,$,(${elementIds
          .map((id) => `#${id}`)
          .join(',')}),#${storeyId});`,
      )
    }
    const storeyIds = [...this.storeyIds.values()]
    relLines.push(
      `#${this.next()}= IFCRELAGGREGATES('${this.guid()}',$,$,$,#${this.buildingId},(${storeyIds
        .map((id) => `#${id}`)
        .join(',')}));`,
    )

    return [
      'ISO-10303-21;',
      'HEADER;',
      `FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');`,
      `FILE_NAME('${this.fileName}','2026-07-04T00:00:00',('Cheng'),(''),'fab-generator','fab-generator','');`,
      `FILE_SCHEMA(('IFC4'));`,
      'ENDSEC;',
      '',
      'DATA;',
      ...this.lines,
      ...relLines,
      'ENDSEC;',
      '',
      'END-ISO-10303-21;',
      '',
    ].join('\n')
  }
}

// ── Main fab building: cleanroom level + sub-fab utility level ────────────
const fab = new IfcWriter(
  'fab-building.ifc',
  'Semiconductor Fab Digital Twin',
  'Fab 1 Main Building',
  'fab-building',
)

const cleanroom = fab.addStorey('Cleanroom Level', 0)
const subfab = fab.addStorey('Sub-Fab Utility Level', -3.4)

// cleanroom slab (top of slab = z 0, devices sit on it)
fab.addBox(cleanroom, 'IFCSLAB', 'Cleanroom Waffle Slab', 0, 0, -0.3, 30, 20, 0.3, 'FLOOR')

// perimeter columns, clear of the equipment rows
const columnXs = [-13.6, -9, -4.5, 0, 4.5, 9, 13.6]
for (const [row, cy] of [['N', -8.8], ['S', 8.8]]) {
  for (let i = 0; i < columnXs.length; i++) {
    fab.addBox(
      cleanroom,
      'IFCCOLUMN',
      `Column ${row}${i + 1}`,
      columnXs[i],
      cy,
      0,
      0.4,
      0.4,
      4.6,
      'COLUMN',
    )
  }
}

// full-height walls on the two far sides, knee walls on the camera side
fab.addBox(cleanroom, 'IFCWALL', 'Wall West', -14.9, 0, 0, 0.25, 20, 4.8, 'SOLIDWALL')
fab.addBox(cleanroom, 'IFCWALL', 'Wall North', 0, -9.9, 0, 30, 0.25, 4.8, 'SOLIDWALL')
fab.addBox(cleanroom, 'IFCWALL', 'Parapet East', 14.9, 0, 0, 0.25, 20, 1.0, 'PARAPET')
fab.addBox(cleanroom, 'IFCWALL', 'Parapet South', 0, 9.9, 0, 30, 0.25, 1.0, 'PARAPET')

// roof edge beams above the column rows
fab.addBox(cleanroom, 'IFCBEAM', 'Roof Beam N', 0, -8.8, 4.45, 29.6, 0.35, 0.35, 'BEAM')
fab.addBox(cleanroom, 'IFCBEAM', 'Roof Beam S', 0, 8.8, 4.45, 29.6, 0.35, 0.35, 'BEAM')

// sub-fab level below grade
fab.addBox(subfab, 'IFCSLAB', 'Sub-Fab Slab', 0, 0, -3.4, 30, 20, 0.3, 'BASESLAB')
for (const [row, cy] of [['N', -8.8], ['S', 8.8]]) {
  for (let i = 0; i < columnXs.length; i++) {
    fab.addBox(
      subfab,
      'IFCCOLUMN',
      `Sub Column ${row}${i + 1}`,
      columnXs[i],
      cy,
      -3.1,
      0.4,
      0.4,
      2.8,
      'COLUMN',
    )
  }
}

const subfabUnits = [
  ['CUP Pump Skid A', -10, -4, 2.6, 1.6, 1.5],
  ['CUP Pump Skid B', -6.5, -4, 2.6, 1.6, 1.5],
  ['Vacuum Pump Bank', -1.5, -4, 3.4, 1.8, 1.3],
  ['Gas Cabinet Row', 4, -4, 4.2, 1.4, 2.1],
  ['Chem Distribution', 9.5, -4, 3, 1.8, 1.8],
  ['UPW Polish Loop', -8, 4, 3.2, 1.8, 1.7],
  ['Exhaust Scrubber Pair', -2, 4, 3.6, 2, 2.2],
  ['Waste Collection', 4.5, 4, 2.8, 1.8, 1.4],
]
for (const [name, cx, cy, sx, sy, h] of subfabUnits) {
  fab.addBox(subfab, 'IFCBUILDINGELEMENTPROXY', name, cx, cy, -3.1, sx, sy, h)
}

// ── Support annex: central utility building beside the fab ────────────────
const annex = new IfcWriter(
  'fab-support-annex.ifc',
  'Fab Support Annex',
  'Central Utility Building',
  'fab-annex',
)
const cub = annex.addStorey('CUB Ground Level', 0)

annex.addBox(cub, 'IFCSLAB', 'CUB Slab', 0, 0, -0.3, 10, 8, 0.3, 'FLOOR')
for (const [cx, cy] of [[-4.4, -3.4], [4.4, -3.4], [-4.4, 3.4], [4.4, 3.4]]) {
  annex.addBox(cub, 'IFCCOLUMN', `CUB Column ${cx < 0 ? 'W' : 'E'}${cy < 0 ? 'N' : 'S'}`, cx, cy, 0, 0.35, 0.35, 3.6, 'COLUMN')
}
annex.addBox(cub, 'IFCWALL', 'CUB Parapet W', -4.9, 0, 0, 0.2, 8, 0.9, 'PARAPET')
annex.addBox(cub, 'IFCWALL', 'CUB Parapet E', 4.9, 0, 0, 0.2, 8, 0.9, 'PARAPET')
annex.addBox(cub, 'IFCWALL', 'CUB Parapet N', 0, -3.9, 0, 10, 0.2, 0.9, 'PARAPET')
annex.addBox(cub, 'IFCWALL', 'CUB Parapet S', 0, 3.9, 0, 10, 0.2, 0.9, 'PARAPET')
annex.addBox(cub, 'IFCBUILDINGELEMENTPROXY', 'Bulk N2 Tank', -1.8, 0, 0, 2, 2, 3.1)
annex.addBox(cub, 'IFCBUILDINGELEMENTPROXY', 'Bulk CDA Tank', 1.8, 0, 0, 2, 2, 3.1)
annex.addBox(cub, 'IFCBUILDINGELEMENTPROXY', 'Chiller Skid', 0, -2.6, 0, 3.2, 1.6, 1.5)

writeFileSync(resolve(OUT_DIR, 'fab-building.ifc'), fab.toString())
writeFileSync(resolve(OUT_DIR, 'fab-support-annex.ifc'), annex.toString())
console.log('Generated fab-building.ifc and fab-support-annex.ifc')
