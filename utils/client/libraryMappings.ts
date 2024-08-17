interface LibraryInfo {
  displayName: string;
  url?: string;
}

interface LibraryMappings {
  [key: string]: LibraryInfo;
}

export const libraryMappings: LibraryMappings = {
  'Ananda Youtube': {
    displayName: 'Ananda YouTube',
    url: 'https://www.youtube.com/user/AnandaWorldwide',
  },
  Treasures: {
    displayName: 'Treasures',
    url: 'https://www.treasuresalongthepath.com/',
  },
  'Ananda Library': {
    displayName: 'Ananda Library',
    url: 'https://www.anandalibrary.org/',
  },
};

export function getMappedLibraryName(libraryName: string): string {
  return libraryMappings[libraryName]?.displayName || libraryName;
}

export function getLibraryUrl(libraryName: string): string | undefined {
  return libraryMappings[libraryName]?.url;
}
