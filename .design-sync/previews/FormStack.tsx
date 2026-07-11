import { Button, ErrorMsg, FieldHint, FormStack, OrDivider, TextInput } from 'tensies-ui';

/** Dark app surface — FormStack renders at full card width (cardMode: column). */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 380,
  margin: '0 auto',
};

/** The real landing form: hint, name field, gold CTA, divider, error line. */
export const LandingForm = () => (
  <div style={dark}>
    <FormStack>
      <FieldHint>
        Play with any name, or{' '}
        <a className="field-hint-link" href="/signin">
          sign up
        </a>{' '}
        to keep your stats.
      </FieldHint>
      <TextInput placeholder="Your name" maxLength={20} defaultValue="Dapper Badger" />
      <Button block>Create Game</Button>
      <OrDivider />
      <ErrorMsg />
    </FormStack>
  </div>
);

/** The join form: code field over the name, join CTA, live error. */
export const JoinForm = () => (
  <div style={dark}>
    <FormStack>
      <TextInput code placeholder="ABCDE" maxLength={5} defaultValue="KQZXV" />
      <TextInput placeholder="Your name" maxLength={20} defaultValue="Salty Walrus" />
      <Button block>Join Game</Button>
      <ErrorMsg>Game not found</ErrorMsg>
    </FormStack>
  </div>
);
