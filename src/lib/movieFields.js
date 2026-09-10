// Columns a movie card needs. Listing pages select only these instead of
// `*`, which keeps description/keywords/search_vector out of every grid
// payload without changing which rows come back.
export const MOVIE_CARD_FIELDS =
  'id,slug,title,year,rating,runtime_minutes,channel,tags,poster_url,trailer_url,featured,created_at'
