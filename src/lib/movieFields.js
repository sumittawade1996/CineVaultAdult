// Columns a movie card needs. Listing pages select only these instead of
// `*`, which keeps description/keywords/search_vector out of every grid
// payload without changing which rows come back.
export const MOVIE_CARD_FIELDS =
  'id,slug,title,year,rating,runtime_minutes,channel,tags,poster_url,trailer_url,featured,created_at'

// Performer, channel and category pages also need the cast (to filter and to
// count co-stars) and the source. The build script and the page use this one
// list so the prerendered data and the browser's data have the same shape.
export const TAXONOMY_FIELDS = `${MOVIE_CARD_FIELDS},actors,source`
