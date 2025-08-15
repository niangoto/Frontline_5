// Пример: stretchFrontline(INITIAL_FRONTLINE, 2) ще разтегне линията по X и Y 2 пъти

function stretchFrontline(points, scale) {
    const stretched = points.map(([x, y]) => [Math.round(x * scale), Math.round(y * scale)]);
    let code = 'const INITIAL_FRONTLINE = [\n';
    for (const [x, y] of stretched) {
        code += `    [${x}, ${y}],\n`;
    }
    code += '];\n';
    console.log(code);
    return stretched;
}

// Пример за използване:
// stretchFrontline(INITIAL_FRONTLINE, 2);