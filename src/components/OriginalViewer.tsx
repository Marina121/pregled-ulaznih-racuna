import { useState } from 'react'
import { Alert, Box, Group, SegmentedControl, Text } from '@mantine/core'
import type { Invoice } from '../types/invoice'

export function OriginalViewer({ invoice }: { invoice: Invoice }) {
  const [zoom, setZoom] = useState('100')
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
          <SegmentedControl
            size="xs"
            value={zoom}
            onChange={setZoom}
            data={[
              { label: 'Prilagodi', value: '100' },
              { label: '150%', value: '150' },
              { label: '200%', value: '200' },
            ]}
          />
        )}
      </Group>
      <Box style={{ flex: 1, overflow: 'auto', background: 'var(--mantine-color-gray-1)' }}>
        {isPdf ? (
          <iframe title={invoice.id} src={src} style={{ width: '100%', height: '100%', border: 0 }} />
        ) : (
          <img src={src} alt={`Račun ${invoice.id}`} style={{ width: `${zoom}%`, display: 'block' }} />
        )}
      </Box>
    </Box>
  )
}
