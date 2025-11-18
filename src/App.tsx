import { compile, glsl, uniform } from '@bigmistqke/view.gl/tag'
import clsx from 'clsx'
import { AiFillPlayCircle, AiOutlinePause } from 'solid-icons/ai'
import {
  createEffect,
  createMemo,
  createSelector,
  createSignal,
  For,
  on,
  onMount,
  Setter,
  Show,
  type Component,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import styles from './App.module.css'
import './index.css'

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

function TimeControl(props: {
  class?: string
  value: number
  onDecrement(): void
  onIncrement(): void
}) {
  return (
    <div class={clsx(styles.timeControl, props.class)}>
      <div>
        <For each={props.value.toFixed(1).split('')}>{char => <span>{char}</span>}</For>
      </div>
      <div>
        <button
          class={clsx(styles.button, props.value > 0.5 ? false : styles.disabled)}
          onClick={() => (props.value > 0.5 ? props.onDecrement() : undefined)}
        >
          &minus;
        </button>
        <div />
        <button
          class={clsx(styles.button, props.value < 9.5 ? false : styles.disabled)}
          onClick={() => (props.value < 9.5 ? props.onIncrement() : undefined)}
        >
          +
        </button>
      </div>
    </div>
  )
}

const App: Component = () => {
  let canvas: HTMLCanvasElement = null!

  const [count, setCount] = createSignal(0)
  const [config, setConfig] = createStore<{
    in: number
    out: number
  }>({
    in: 3.5,
    out: 5,
  })
  const [playing, setPlaying] = createSignal(false)
  const [phase, _setPhase] = createSignal<'in' | 'out'>('in')

  const setPhase: Setter<'in' | 'out'> = newPhase => {
    _setPhase(newPhase)
    if (newPhase === 'in') {
      setCount(count => count + 1)
    }
    audioApi()?.play(
      isPhaseSelected('in')
        ? // C2
          130.81
        : // G#3
          207.65,
    )
  }

  const audioApi = createMemo(on(playing, createAudioApi, { defer: true }))

  const isPhaseSelected = createSelector(phase)
  const direction = () => (isPhaseSelected('in') ? 1 : -1)

  function getGL() {
    const gl = canvas.getContext('webgl2', { antialias: true })
    if (!gl) {
      throw new Error(
        `Expected canvas.getContext('webgl2') to return WebGL2RenderingContext, but returned null`,
      )
    }
    return gl
  }

  function setup() {
    const gl = getGL()

    const fragment = glsl`#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 outColor;
${uniform.float('u_value')}

void main() {
  if(v_uv[1] > u_value){
    outColor = vec4(1.0);
  }else{
    discard;
  }
}`
    const { program, view } = compile.toQuad(gl, fragment, { webgl2: true })

    gl.useProgram(program)

    function resize() {
      canvas.height = window.innerHeight
      canvas.width = window.innerWidth
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    window.addEventListener('resize', resize)
    resize()

    let animationFrame: number
    let previous: number | undefined = undefined
    let current = -1

    function render() {
      view.attributes.a_quad.bind()
      view.uniforms.u_value.set(current)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    function animate() {
      animationFrame = requestAnimationFrame(function (time) {
        try {
          if (!previous) {
            return
          }

          const delta = time - previous
          const duration = config[phase()]

          if (duration <= 0) {
            return
          }

          current += (delta * direction()) / (duration * 1_000)

          if (direction() > 0) {
            if (current >= 1) {
              setPhase('out')
            }
          } else {
            if (current <= -1) {
              setPhase('in')
            }
          }

          render()
        } finally {
          previous = time
          animate()
        }
      })
    }

    render()

    createEffect(() => {
      if (playing()) {
        animate()
      } else {
        previous = undefined
        cancelAnimationFrame(animationFrame)
      }
    })
  }

  onMount(setup)

  return (
    <>
      <div class={styles.ui}>
        <div class={styles.center}>
          <button
            class={clsx(styles.button, styles.playButton)}
            onClick={() => setPlaying(p => !p)}
          >
            <Show when={playing()} fallback={<AiFillPlayCircle />}>
              <AiOutlinePause />
            </Show>
          </button>
          <span>
            <Show when={count() > 0}>{count()}</Show>
          </span>
        </div>
        <section
          class={clsx(
            styles.panel,
            styles.in,
            !playing() && styles.pausing,
            isPhaseSelected('in') && styles.selected,
          )}
        >
          <h1 class={styles.panelTitle}>IN</h1>
          <TimeControl
            value={config.in}
            onDecrement={() => setConfig('in', v => v - 0.5)}
            onIncrement={() => setConfig('in', v => v + 0.5)}
          />
        </section>
        <section
          class={clsx(
            styles.panel,
            styles.out,
            !playing() && styles.pausing,
            isPhaseSelected('out') && styles.selected,
          )}
        >
          <h1 class={styles.panelTitle}>OUT</h1>
          <TimeControl
            value={config.out}
            onDecrement={() => setConfig('out', v => v - 0.5)}
            onIncrement={() => setConfig('out', v => v + 0.5)}
          />
        </section>
      </div>
      <canvas ref={canvas} class={styles.canvas} />
    </>
  )
}

export default App
