interface LibraryMappings {
  [key: string]: string;
}

export const libraryMappings: LibraryMappings = {
  'Ananda Youtube': 'Ananda YouTube',
  // Add more mappings here as needed
};

export function getMappedLibraryName(libraryName: string): string {
  return libraryMappings[libraryName] || libraryName;
}
