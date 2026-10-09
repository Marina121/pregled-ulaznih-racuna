import { useState, type FC } from 'react'
import { Alert, Box, Button, Group, Text } from '@mantine/core'
import type { Invoice } from '../types/invoice'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '../config'

export type Props = {
  invoice: Invoice
}

export const OriginalViewer: FC<Props> = ({ invoice }) => {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [drag, setDrag] = useState<{
    x: number
    y: number
    left: number
    top: number
  } | null>(null)
  const original = invoice.original

  if (!original) {
    return (
      <Box p="md">
        <Alert color="yellow" title="Original nije priložen">
          Račun je stigao e-poštom bez priloga. Možeš provjeriti samo izvučene vrijednosti, a ne i
          usporediti ih s dokumentom.
        </Alert>
      </Box>
    )
  }

  const src = `/${original.path}`
  const isPdf = original.mimeType === 'application/pdf'

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group
        justify="space-between"
        p="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Text size="xs" c="dimmed">
          {invoice.originalFilename} · {original.pages} str. ·{' '}
          {invoice.channel === 'mobile' ? 'fotografija' : 'e-pošta'}
        </Text>
        {!isPdf && (
          <Group gap={4}>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setZoom(100)}
              disabled={zoom === 100}
            >
              Prilagodi
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
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
              onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Povećaj"
            >
              +
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              component="a"
              href={src}
              target="_blank"
              rel="noreferrer"
            >
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
        onPointerDown={(event) => {
          if (isPdf || zoom === MIN_ZOOM) return
          event.preventDefault() // otherwise the browser drags the image as a file
          setDrag({
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          })
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag) return
          event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x)
          event.currentTarget.scrollTop = drag.top - (event.clientY - drag.y)
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {isPdf ? (
          <iframe
            title={invoice.id}
            src={src}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <img
            src={src}
            alt={`Račun ${invoice.id}`}
            draggable={false}
            style={{
              width: `${zoom}%`,
              maxWidth: 'none',
              display: 'block',
              userSelect: 'none',
            }}
          />
        )}
      </Box>
    </Box>
  )
}
