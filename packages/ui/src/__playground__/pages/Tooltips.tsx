/* c8 ignore start */

import { UIButton, UILink, UITooltip } from 'scripts/react/index';

/**
 * Tooltips page.
 */
export default function Tooltips(): JSX.Element {
  return (
    <div>
      <main className="grid cols-1 hgap-3 vgap-5">
        <a href="/react">GO BACK</a>
        <section className="grid cols-12">
          <UITooltip label="Hello World! This is a very very very very very very very very very very very very very very very very very long tooltip" modifiers="top">
            <UIButton icon="star" />
          </UITooltip>
          <UITooltip label="Hello World! This is a very very very very very very very very very very very very very very very very very long tooltip" modifiers="left">
            <UIButton icon="star" />
          </UITooltip>
          <UITooltip label="Hello World! This is a very very very very very very very very very very very very very very very very very long tooltip" modifiers="bottom">
            <UIButton icon="star" />
          </UITooltip>
          <UITooltip label="Hello World! This is a very very very very very very very very very very very very very very very very very long tooltip" modifiers="right">
            <UIButton icon="star" />
          </UITooltip>
          <UITooltip label="More info" description="This is a more detailled description.">
            <UIButton icon="star" />
          </UITooltip>
          <UITooltip label="More info" description="This is a more more detailled description." modifiers="right">
            <UIButton icon="star" />
          </UITooltip>
          <UITooltip label="This is a link" modifiers="right">
            <UILink href="https://test.com" label="Test" />
          </UITooltip>
        </section>
      </main>
    </div>
  );
}

Tooltips.displayName = 'Tooltips';
