// BuSe Frontline Shape Example
// This file exports an array of points for the BuSe map's frontline shape.
// You can further edit the points for a more realistic curve if needed.

// Поставете данните, експортирани от редактора (BuSe-editor.html), в този файл.
// Заменете съдържанието на масива BuSe_FRONTLINE с новите точки.
// Ако редакторът експортира и BuSe_CAPITALS, добавете и тях тук, например:

// BuSe карта: фронтова линия и столици
// BuSe карта: фронтова линия и столици
const BuSe_FRONTLINE = [[362,0],[362,33],[345,45],[323,61],[318,130],[325,178],[339,199],[339,247],[350,269],[368,283],[388,297],[401,326],[409,354],[430,367],[429,401],[411,426],[393,445],[390,483],[362,487],[345,492],[330,510],[340,541],[333,569],[330,600]];
const BuSe_CAPITALS = [[215,316],[494,549]];
const BuSe_SEA = [[[399,1],[417,21],[437,28],[436,53],[413,65],[407,93],[405,119],[419,129],[437,135],[468,128],[490,120],[517,123],[537,139],[569,139],[586,156],[615,163],[637,178],[679,178],[687,163],[699,156],[699,6],[400,3]]];if (typeof window !== 'undefined') {
    window.BuSe_FRONTLINE = BuSe_FRONTLINE;
    window.BuSe_CAPITALS = BuSe_CAPITALS;
}

// За Node.js:
if (typeof module !== 'undefined') {
    module.exports = { BuSe_FRONTLINE, BuSe_CAPITALS };
}
