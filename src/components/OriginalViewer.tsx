import { useState } from 'react'
import { Alert, Box, Button, Group, Text } from '@mantine/core'
import type { Invoice } from '../types/invoice'

// 100% = image fits the frame width. Phone photos have small print, so zoom goes up to 400%.
const MIN_ZOOM = 100
const MAX_ZOOM = 400
const ZOOM_STEP = 50

export function OriginalViewer({ invoice }: { invoice: Invoice }) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  // A zoomed image can be panned by dragging. Remembers where the drag started.
  const [drag, setDrag] = useState<{ x: number; y: number; left: number; top: number } | null>(null)
  const o = invoice.original

  if (!o) {
    return (
      <Box p="md">
        <Alert color="yellow" title="Original nije priložen">
          Račun je stigao e-poštom bez priloga. Možeš provjeriti samo izvučene vrijednosti, a ne i usporediti ih s
          dokumentom.
        </Alert>
      </Box>
    )
  }

  const src = `/${o.path}`
  const isPdf = o.mimeType === 'application/pdf'

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Text size="xs" c="dimmed">
          {invoice.originalFilename} · {o.pages} str. · {invoice.channel === 'mobile' ? 'fotografija' : 'e-pošta'}
        </Text>
        {!isPdf && (
          <Group gap={4}>
            <Button size="compact-xs" variant="default" onClick={() => setZoom(100)} disabled={zoom === 100}>
              Prilagodi
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Smanji"
            >
              −
            </Button>
            <Text size="xs" w={40} ta="center">
              {zoom}%
            </Text>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Povećaj"
            >
              +
            </Button>
            {/* For tiny print beyond 400%: the browser has its own zoom and shows full resolution. */}
            <Button size="compact-xs" variant="subtle" component="a" href={src} target="_blank" rel="noreferrer">
              Otvori u novoj kartici
            </Button>
          </Group>
        )}
      </Group>
      <Box
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--mantine-color-gray-1)',
          cursor: !isPdf && zoom > MIN_ZOOM ? (drag ? 'grabbing' : 'grab') : undefined,
        }}
        onPointerDown={(e) => {
          if (isPdf || zoom === MIN_ZOOM) return
          e.preventDefault() // otherwise the browser starts dragging the image as a file
          setDrag({ x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop })
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag) return
          e.currentTarget.scrollLeft = drag.left - (e.clientX - drag.x)
          e.currentTarget.scrollTop = drag.top - (e.clientY - drag.y)
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {isPdf ? (
          <iframe title={invoice.id} src={src} style={{ width: '100%', height: '100%', border: 0 }} />
        ) : (
          <img
            src={src}
            alt={`Račun ${invoice.id}`}
            draggable={false}
            style={{ width: `${zoom}%`, maxWidth: 'none', display: 'block', userSelect: 'none' }}
          />
        )}
      </Box>
    </Box>
  )
}
