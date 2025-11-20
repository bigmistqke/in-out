import clsx from 'clsx'
import { AiFillPlayCircle, AiOutlinePause } from 'solid-icons/ai'
import {
  batch,
  createEffect,
  createMemo,
  createSelector,
  createSignal,
  Match,
  on,
  onMount,
  Show,
  Switch,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import styles from './App.module.css'
import './index.css'

const BREATHES_PER_SESSION = 10

function createAudioApi() {
  const context = new AudioContext()

  function envelope(
    gainNode: GainNode,
    attack: number,
    decay: number,
    sustain: number,
    release: number,
  ) {
    const now = context.currentTime
    gainNode.gain.cancelScheduledValues(0)
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(1, now + attack)
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay)
    gainNode.gain.linearRampToValueAtTime(0, now + attack + decay + release)
  }

  return {
    play(frequency: number) {
      // create Oscillator node
      const gainNode = new GainNode(context, { gain: 0 })
      gainNode.gain
      gainNode.connect(context.destination)
      envelope(gainNode, 0, 0.25, 0.25, 0.25)

      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, context.currentTime) // value in hertz
      oscillator.start()
      oscillator.connect(gainNode)

      setTimeout(() => oscillator.stop(), 1_000)
    },
  }
}

function TimeControl(props: { class?: string; value: number; onInput(delta: number): void }) {
  function handleInput(delta: number) {
    if (delta < 0) {
      if (props.value + delta > 0) {
        props.onInput(delta)
      }
    } else {
      if (props.value + delta < 100) {
        props.onInput(delta)
      }
    }
  }

  function handlePointer(
    event: PointerEvent & { currentTarget: HTMLButtonElement },
    delta: number,
  ) {
    handleInput(delta)
    let next = setInterval(() => handleInput(delta), 1_000 / 4)
    event.currentTarget.addEventListener('pointerup', () => clearInterval(next))
    event.currentTarget.addEventListener('pointerleave', () => clearInterval(next))
  }

  return (
    <div class={clsx(styles.timeControl, props.class)}>
      <div class={styles.top}>
        <div class={props.value > 0.5 ? undefined : styles.disabled}>&minus;</div>
        <output>{props.value.toFixed(1).replace('.', ',')}</output>
        <div class={props.value < 99.5 ? undefined : styles.disabled}>+</div>
      </div>
      <div class={styles.bottom}>
        <button
          class={styles.button}
          onPointerDown={event => handlePointer(event, -0.5)}
          onContextMenu={event => event.preventDefault()}
        />
        <button
          class={styles.button}
          onPointerDown={event => handlePointer(event, 0.5)}
          onContextMenu={event => event.preventDefault()}
        />
      </div>
    </div>
  )
}

function Overlay(props: { value: number }) {
  return (
    <>
      <div class={styles.overlayFilter} />
      <svg
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        class={styles.overlay}
      >
        <rect
          x={0}
          y={0}
          height={Math.max(0, 100 - props.value * 100)}
          width="100%"
          class={styles.overlayBar}
        />
      </svg>
    </>
  )
}

export function App() {
  const [config, setConfig] = createStore<{
    in: number
    out: number
  }>({
    in: 3.5,
    out: 12,
  })

  const [mode, setMode] = createSignal<'initial' | 'playing' | 'paused' | 'completed'>('initial')
  const [value, setValue] = createSignal(0)
  const [count, setCount] = createSignal(0)
  const [phase, setPhase] = createSignal<'in' | 'out'>('in')

  const isModeSelected = createSelector(mode)
  const isPhaseSelected = createSelector(phase)
  const audioApi = createMemo(on(() => mode() !== 'initial', createAudioApi, { defer: true }))
  const direction = () => (isPhaseSelected('in') ? 1 : -1)

  onMount(() => {
    let animationFrame: number
    let previous: number | undefined = undefined

    function animate(time: number) {
      // Request next frame
      animationFrame = requestAnimationFrame(animate)

      batch(() => {
        const delta = previous && time - previous
        previous = time

        if (!delta) return

        const duration = config[phase()]

        setValue(value => (value += (delta * direction()) / (duration * 1_000)))

        if (direction() > 0) {
          if (value() >= 1) {
            setPhase('out')
          }
        } else {
          if (value() <= 0) {
            setPhase('in')
          }
        }
      })
    }

    createEffect(() => {
      if (mode() === 'playing') {
        animationFrame = requestAnimationFrame(animate)
      } else {
        previous = undefined
        cancelAnimationFrame(animationFrame)
      }
    })

    createEffect(
      on(
        phase,
        () => {
          audioApi()?.play(
            isPhaseSelected('in')
              ? // C2
                130.81
              : // G#3
                207.65,
          )

          if (isPhaseSelected('in')) {
            setCount(count => count + 1)
            if (count() === BREATHES_PER_SESSION) {
              setMode('completed')
              setCount(0)
            }
          }
        },
        { defer: true },
      ),
    )
  })

  return (
    <>
      <div class={styles.ui}>
        <div class={styles.center}>
          <button
            class={clsx(styles.button, styles.playButton)}
            onClick={() => setMode(() => (isModeSelected('playing') ? 'paused' : 'playing'))}
          >
            <Show when={isModeSelected('playing')} fallback={<AiFillPlayCircle />}>
              <AiOutlinePause />
            </Show>
          </button>
          <span>
            <Switch>
              <Match when={isModeSelected('completed')}>Session Completed</Match>
              <Match when={isModeSelected('paused')}>{BREATHES_PER_SESSION - count()} to go</Match>
            </Switch>
          </span>
        </div>
        <section
          class={clsx(
            styles.panel,
            styles.in,
            isModeSelected('playing') && styles.playing,
            isPhaseSelected('in') && styles.selected,
          )}
        >
          <h1 class={styles.panelTitle}>in</h1>
          <TimeControl value={config.in} onInput={delta => setConfig('in', v => v + delta)} />
        </section>
        <section
          class={clsx(
            styles.panel,
            styles.out,
            isModeSelected('playing') && styles.playing,
            isPhaseSelected('out') && styles.selected,
          )}
        >
          <h1 class={styles.panelTitle}>out</h1>
          <TimeControl value={config.out} onInput={delta => setConfig('out', v => v + delta)} />
        </section>
      </div>
      <Overlay value={value()} />
    </>
  )
}
