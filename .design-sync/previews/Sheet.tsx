import {
  AudioButton,
  Button,
  ErrorMsg,
  FormStack,
  Sheet,
  TextInput,
} from 'tensies-ui';

/* The sheet is fixed to the viewport bottom. A transformed phone frame
   becomes its containing block, so it anchors to the frame bottom and gets
   real layout height for capture. Children are the real join form composed
   from tensies-ui controls. */
const frame: React.CSSProperties = {
  position: 'relative',
  width: 390,
  height: 620,
  transform: 'translateZ(0)',
  overflow: 'hidden',
  borderRadius: 12,
  background: 'var(--color-bg)',
};

export const JoinForm = () => (
  <div style={frame}>
    <Sheet title="Join a Game">
      <FormStack>
        <TextInput placeholder="Your name" maxLength={20} />
        <TextInput code placeholder="ABCDE" maxLength={5} />
        <AudioButton state="idle">
          <span>Listen</span>
        </AudioButton>
        <Button block>Join Game</Button>
        <ErrorMsg />
      </FormStack>
    </Sheet>
  </div>
);
