
export interface Place {
    url: string
    island: 'North'|'South'
    name: string
    wikiUrl: string
}

const places:Place[] = [
    {
      "name": "Northland",
      "island": "North",
      "url": "tools/2018-census-place-summaries/northland-region",
      "wikiUrl": "Northland_Region"
    },
    {
      "name": "Auckland",
      "island": "North",
      "url": "tools/2018-census-place-summaries/auckland-region",
      "wikiUrl": "Auckland_Region"
    },
    {
      "name": "Waikato",
      "island": "North",
      "url": "tools/2018-census-place-summaries/waikato-region",
      "wikiUrl": "Waikato_Region"
    },
    {
      "name": "Bay of Plenty",
      "island": "North",
      "url": "tools/2018-census-place-summaries/bay-of-plenty-region",
      "wikiUrl": "Bay_of_Plenty_Region"
    },
    {
      "name": "Gisborne",
      "island": "North",
      "url": "tools/2018-census-place-summaries/gisborne-region",
      "wikiUrl": "Gisborne_District"
    },
    {
      "name": "Hawke’s Bay",
      "island": "North",
      "url": "tools/2018-census-place-summaries/hawkes-bay-region",
      "wikiUrl": "Hawke's_Bay"
    },
    {
      "name": "Taranaki",
      "island": "North",
      "url": "tools/2018-census-place-summaries/taranaki-region",
      "wikiUrl": "Taranaki_Region"
    },
    {
      "name": "Manawatū-Whanganui",
      "island": "North",
      "url": "tools/2018-census-place-summaries/manawatu-whanganui-region",
      "wikiUrl": "Manawatū-Whanganui"
    },
    {
      "name": "Wellington",
      "island": "North",
      "url": "tools/2018-census-place-summaries/wellington-region",
      "wikiUrl": "Wellington_Region"
    },
    {
      "name": "Tasman",
      "island": "South",
      "url": "tools/2018-census-place-summaries/tasman-region",
      "wikiUrl": "Tasman_District"
    },
    {
      "name": "Nelson",
      "island": "South",
      "url": "tools/2018-census-place-summaries/nelson-region",
      "wikiUrl": "Nelson,_New_Zealand"
    },
    {
      "name": "Marlborough",
      "island": "South",
      "url": "tools/2018-census-place-summaries/marlborough-region",
      "wikiUrl": "Marlborough_Region"
    },
    {
      "name": "West Coast",
      "island": "South",
      "url": "tools/2018-census-place-summaries/west-coast-region",
      "wikiUrl": "West_Coast_Region"
    },
    {
      "name": "Canterbury",
      "island": "South",
      "url": "tools/2018-census-place-summaries/canterbury-region",
      "wikiUrl": "Canterbury_Region"
    },
    {
      "name": "Otago",
      "island": "South",
      "url": "tools/2018-census-place-summaries/otago-region",
      "wikiUrl": "Otago_Region"
    },
    {
      "name": "Southland",
      "island": "South",
      "url": "tools/2018-census-place-summaries/southland-region",
      "wikiUrl": "Southland_Region"
    }
  ]

  export {
    places
  }