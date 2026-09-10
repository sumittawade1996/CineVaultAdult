import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import AdSlot from './components/AdSlot'
import RequireAdmin from './components/RequireAdmin'
import Home from './pages/Home'
import Movies from './pages/Movies'

// Route-level code splitting: the two main landing pages (home and
// /movies) ship in the initial bundle so a deep link to /movies doesn't
// pay an extra round-trip before it can fetch data; everything else is
// downloaded on first visit.
const MovieDetail = lazy(() => import('./pages/MovieDetail'))
const Articles = lazy(() => import('./pages/Articles'))
const ArticleDetail = lazy(() => import('./pages/ArticleDetail'))
const AdminUpload = lazy(() => import('./pages/AdminUpload'))
const AdminArticle = lazy(() => import('./pages/AdminArticle'))
const AdminMovie = lazy(() => import('./pages/AdminMovie'))
const Actors = lazy(() => import('./pages/Actors'))
const ActorDetail = lazy(() => import('./pages/ActorDetail'))
const Channels = lazy(() => import('./pages/Channels'))
const ChannelDetail = lazy(() => import('./pages/ChannelDetail'))
const Categories = lazy(() => import('./pages/Categories'))
const CategoryDetail = lazy(() => import('./pages/CategoryDetail'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteFallback() {
  return <div className="container route-fallback" aria-hidden="true" />
}

export default function App() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <>
      <Navbar />
      {!isAdmin && (
        <div className="container">
          <AdSlot slot="header" />
        </div>
      )}
      <main id="main">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/movie/:slug" element={<MovieDetail />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/article/:slug" element={<ArticleDetail />} />
            <Route path="/actors" element={<Actors />} />
            <Route path="/actor/:slug" element={<ActorDetail />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/channel/:slug" element={<ChannelDetail />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/category/:slug" element={<CategoryDetail />} />
            <Route path="/admin/upload" element={<RequireAdmin><AdminUpload /></RequireAdmin>} />
            <Route path="/admin/article" element={<RequireAdmin><AdminArticle /></RequireAdmin>} />
            <Route path="/admin/movie" element={<RequireAdmin><AdminMovie /></RequireAdmin>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdmin && (
        <div className="container">
          <AdSlot slot="footer" />
        </div>
      )}
      <Footer />
      {!isAdmin && <AdSlot slot="stickyMobile" />}
    </>
  )
}
