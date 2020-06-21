import { PrimitiveType } from '@boost/args';
import applyMarkdown from './applyMarkdown';
import applyStyle from './applyStyle';
import formatValue from './formatValue';
import { msg } from '../constants';

export default function formatDescription(
  config: {
    choices?: PrimitiveType[];
    default?: PrimitiveType;
    description: string;
    deprecated?: boolean;
  },
  tags: string[] = [],
): string {
  let output = applyMarkdown(config.description);

  // Append choices after the description
  if (config.choices) {
    const choices = config.choices.map(
      (choice) =>
        formatValue(choice) + (config.default === choice ? ` (${msg('cli:tagDefault')})` : ''),
    );

    output += ` (${msg('cli:tagChoices')}: ${choices.join(', ')})`;

    // Append default after description if no choices
  } else if (config.default) {
    output += ` (${msg('cli:tagDefault')}: ${formatValue(config.default)})`;
  }

  // Tags go at the end of the description
  if (config.deprecated) {
    tags.unshift(msg('cli:tagDeprecated'));
  }

  if (tags.length > 0) {
    output += ' ';
    output += applyStyle(`[${tags.join(', ')}]`, 'muted');
  }

  return output;
}
