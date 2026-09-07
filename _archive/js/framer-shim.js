// Minimal stand-in for the "framer" package so components exported from
// framer.com/m/... can run outside the Framer editor. Only implements the
// two things AsciiFlowTrail actually touches at runtime.
export const ControlType = {
  Object: 'object',
  Enum: 'enum',
  Number: 'number',
  Boolean: 'boolean',
  Color: 'color',
};

export function addPropertyControls() {
  // no-op — property controls only matter inside the Framer canvas editor
}

export const RenderTarget = {
  current: () => 'export',
  canvas: 'canvas',
  export: 'export',
  preview: 'preview',
};
