import { Tip } from '@shared/types';
import https from 'https';

export async function wikivoyageMcp(input: { city: string; interests: string[] }): Promise<Tip[]> {
  try {
    // Only support Jaipur for now
    if (input.city !== 'Jaipur') {
      return [];
    }

    const apiUrl = 'https://en.wikivoyage.org/w/api.php';
    const params = new URLSearchParams({
      action: 'parse',
      page: 'Jaipur',
      format: 'json',
      prop: 'wikitext',
    });

    const fullUrl = `${apiUrl}?${params.toString()}`;
    let wikitext = await fetchFromMediaWiki(fullUrl);

    // Debug: log headings from wikitext
    let allHeadings: string[] = [];
    if (wikitext) {
      const headingMatches = wikitext.match(/^==+\s*(.+?)\s*==+$/gm);
      allHeadings = headingMatches ? headingMatches.map(h => h.replace(/^==+\s*|\s*==+$/g, '')) : [];
      console.log('WV headings:', allHeadings.slice(0, 30));
      console.log('WV text sample:', wikitext.substring(0, 400));
    }

    // Fallback to HTML if wikitext fails
    if (!wikitext) {
      const paramsHtml = new URLSearchParams({
        action: 'parse',
        page: 'Jaipur',
        format: 'json',
        prop: 'text',
      });
      const fullUrlHtml = `${apiUrl}?${paramsHtml.toString()}`;
      const htmlText = await fetchFromMediaWiki(fullUrlHtml, true);
      if (htmlText) {
        wikitext = htmlText;
      } else {
        return createFallbackTip();
      }
    }

    // Parse sections from wikitext
    const sections = extractSectionsFromWikitext(wikitext);

    // Generate tips based on interests and available sections
    const tips: Tip[] = [];
    let tipCounter = 1;

    // Get around tip (mobility) - highest priority
    const getAroundText = sections['get around'];
    if (getAroundText) {
      const claim = extractFirstSentence(getAroundText);
      if (claim) {
        tips.push({
          id: `tip_wv_${tipCounter++}`,
          claim,
          citations: [{ source: 'Wikivoyage', page: 'Jaipur', anchor: 'Get around' }],
          confidence: 'medium',
          isGeneralAdvice: false,
        });
      }
    }

    // Food interest
    if (input.interests.includes('food')) {
      const eatText = sections['eat'];
      if (eatText) {
        const claim = extractFirstSentence(eatText);
        if (claim) {
          tips.push({
            id: `tip_wv_${tipCounter++}`,
            claim,
            citations: [{ source: 'Wikivoyage', page: 'Jaipur', anchor: 'Eat' }],
            confidence: 'medium',
            isGeneralAdvice: false,
          });
        }
      }
    }

    // Culture interest
    if (input.interests.includes('culture')) {
      let sectionName = '';
      let sectionText = '';

      if (sections['see']) {
        sectionName = 'See';
        sectionText = sections['see'];
      } else if (sections['do']) {
        sectionName = 'Do';
        sectionText = sections['do'];
      } else if (sections['understand']) {
        sectionName = 'Understand';
        sectionText = sections['understand'];
      }

      if (sectionText) {
        const claim = extractFirstSentence(sectionText);
        if (claim) {
          tips.push({
            id: `tip_wv_${tipCounter++}`,
            claim,
            citations: [{ source: 'Wikivoyage', page: 'Jaipur', anchor: sectionName }],
            confidence: 'high',
            isGeneralAdvice: false,
          });
        }
      }
    }

    // Fallback if still no tips
    if (tips.length === 0) {
      // Store headings for debugging in outer scope
      (global as any).wvDebugHeadings = allHeadings;
      return createFallbackTip();
    }

    return tips;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`wikivoyageMcp error: ${errorMsg}`);
    return createFallbackTip();
  }
}

function createFallbackTip(): Tip[] {
  return [
    {
      id: 'tip_wv_1',
      claim: 'Jaipur is a UNESCO World Heritage city with rich Rajasthani culture and architecture.',
      citations: [{ source: 'Wikivoyage', page: 'Jaipur', anchor: 'Overview' }],
      confidence: 'medium',
      isGeneralAdvice: true,
    },
  ];
}

function fetchFromMediaWiki(url: string, isHtml: boolean = false): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 30000);

    https
      .get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          clearTimeout(timeout);
          try {
            const parsed = JSON.parse(data);
            if (isHtml) {
              const text = parsed.parse?.text?.['*'];
              if (text) {
                resolve(text);
              } else {
                resolve(null);
              }
            } else {
              const wikitext = parsed.parse?.wikitext?.['*'];
              if (wikitext) {
                resolve(wikitext);
              } else {
                resolve(null);
              }
            }
          } catch (e) {
            console.error('Failed to parse MediaWiki response');
            resolve(null);
          }
        });
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        console.error(`MediaWiki API error: ${err.message}`);
        resolve(null);
      });
  });
}

function extractSectionsFromWikitext(wikitext: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = wikitext.split('\n');

  let currentTopSection: string | null = null;
  let currentContent: string[] = [];

  const flush = () => {
    if (!currentTopSection) return;
    const contentText = currentContent.join('\n');
    const cleaned = cleanWikiMarkup(contentText);
    if (cleaned.length > 50) {
      sections[currentTopSection] = cleaned;
    }
  };

  for (const line of lines) {
    const m = line.match(/^(=+)\s*(.+?)\s*\1$/);
    if (m) {
      const level = m[1].length;
      const headingName = m[2].trim();

      // Only treat level-2 headings (==Heading==) as section boundaries
      if (level === 2) {
        flush();
        currentTopSection = headingName.toLowerCase();
        currentContent = [];
      } else {
        // Keep subheadings as part of the current top section content
        if (currentTopSection) currentContent.push(headingName);
      }
      continue;
    }

    if (currentTopSection) currentContent.push(line);
  }

  flush();
  return sections;
}

function cleanWikiMarkup(text: string): string {
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Remove templates ({{...}})
  text = text.replace(/\{\{[^}]*\}\}/g, '');

  // Handle internal links [[...]] and [[...|text]]
  text = text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2'); // [[link|text]] -> text
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1'); // [[link]] -> link

  // Handle external links [http://... text]
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
  text = text.replace(/\[https?:\/\/[^\]]+\]/g, '');

  // Remove bold and italic markup
  text = text.replace(/'''([^']+)'''/g, '$1'); // '''bold''' -> bold
  text = text.replace(/''([^']+)''/g, '$1'); // ''italic'' -> italic

  // Remove HTML tags (in case some exist)
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Normalize whitespace
  text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  return text;
}

function extractFirstSentence(text: string): string | null {
  if (!text || text.length === 0) {
    return null;
  }

  // Extract first sentence (up to period, question mark, or exclamation)
  const sentenceMatch = text.match(/[^.!?]*[.!?]/);
  if (sentenceMatch) {
    let sentence = sentenceMatch[0]
      .replace(/[.!?]$/, '') // remove trailing punctuation
      .trim();

    // Must be at least 10 characters to be meaningful
    if (sentence.length >= 10) {
      // Capitalize first letter if not already
      if (sentence[0] && sentence[0].toLowerCase() === sentence[0]) {
        sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      }
      return sentence + '.';
    }
  }

  return null;
}
