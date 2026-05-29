// Quran page-structure data + legacy-format normalization.
import QURAN_PAGE_STRUCTURE_DEFAULT from "../data/quranPages.json";

function transformPageStructureIfNeeded(structure) {
    if (!structure || !Array.isArray(structure) || structure.length === 0) {
        return QURAN_PAGE_STRUCTURE_DEFAULT; // Return default if input is invalid
    }
    // Check if the first item already has the new format. If so, assume the whole file is correct.
    if (structure[0] && Array.isArray(structure[0].surahs)) {
        return structure;
    }

    // This is the old format, so we need to transform it.
    const groupedByPage = {};
    for (const item of structure) {
        if (!item.page || !item.surah) continue; // Skip invalid entries

        if (!groupedByPage[item.page]) {
            groupedByPage[item.page] = [];
        }
        groupedByPage[item.page].push({
            surah: item.surah,
            surah_name: item.surah_name,
            ayahs: item.ayahs
        });
    }

    const newStructure = Object.keys(groupedByPage).map(pageNum => {
        return {
            page: Number(pageNum),
            surahs: groupedByPage[pageNum]
        };
    });

    return newStructure.sort((a, b) => a.page - b.page);
}

export { QURAN_PAGE_STRUCTURE_DEFAULT, transformPageStructureIfNeeded };
