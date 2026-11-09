import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Shown inside the app shell the moment a link is clicked, while the server renders the
// page (and prefetched with the link, so it appears without a round trip).
export default function Loading() {
  return <LoadingSpinner />
}
