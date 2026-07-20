'use client';

// TODO: FActor styles
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface LegalDoc {
  slug: string;
  /** i18n key under `legal.titles` */
  titleKey: string;
  group: 'docs' | 'cookies';
}

/** All 7 legal documents with i18n title keys and grouping. */
const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'legal-notice',
    titleKey: 'legal-notice',
    group: 'docs',
  },
  {
    slug: 'privacy-policy',
    titleKey: 'privacy-policy',
    group: 'docs',
  },
  {
    slug: 'cookie-policy',
    titleKey: 'cookie-policy',
    group: 'docs',
  },
  {
    slug: 'terms-and-conditions',
    titleKey: 'terms-and-conditions',
    group: 'docs',
  },
  {
    slug: 'electronic-signature-policy',
    titleKey: 'electronic-signature-policy',
    group: 'docs',
  },
  {
    slug: 'data-processing-agreement',
    titleKey: 'data-processing-agreement',
    group: 'docs',
  },
  {
    slug: 'document-retention-policy',
    titleKey: 'document-retention-policy',
    group: 'cookies',
  },
];

interface LegalSectionProps {
  /** Which document group to render. */
  group: 'docs' | 'cookies';
}

/**
 * Renders a card list of legal documents filtered by group.
 *
 * The "docs" group contains documents 1–6 (legal basis documents).
 * The "cookies" group contains document 7 (cookie & consent policy).
 *
 * Each card links to `/legal/{slug}` and displays the localized document title.
 */
export function LegalSection({ group }: LegalSectionProps) {
  const t = useTranslations('legal');

  const filteredDocs = LEGAL_DOCS.filter((doc) => doc.group === group);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {filteredDocs.map((doc) => (
        <Card
          key={doc.slug}
          variant="outlined"
          sx={{
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            '&:hover': {
              boxShadow: 2,
              borderColor: 'primary.main',
            },
          }}
        >
          <CardActionArea
            component={Link}
            href={`/legal/${doc.slug}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2.5,
              py: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DescriptionOutlinedIcon
                sx={{ color: 'text.secondary', fontSize: 22 }}
              />
              <Typography
                variant="body1"
                sx={{ fontWeight: 500, color: 'text.primary' }}
              >
                {t(`titles.${doc.titleKey}`)}
              </Typography>
            </Box>

            <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
