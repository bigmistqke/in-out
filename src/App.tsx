import { compile, glsl, uniform } from '@bigmistqke/view.gl/tag'
import clsx from 'clsx'
import { AiFillPlayCircle, AiOutlinePause } from 'solid-icons/ai'
import { createEffect, createSignal, For, onMount, Show, type Component } from 'solid-js'
import { createStore } from 'solid-js/store'
import styles from './App.module.css'
import './index.css'

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
          onClick={() => (props.value < 99.5 ? props.onIncrement() : undefined)}
        >
          +
        </button>
      </div>
    </div>
  )
}

const App: Component = () => {
  let canvas: HTMLCanvasElement = null!

  const [config, setConfig] = createStore<{
    in: number
    out: number
    color1: [number, number, number]
    color2: [number, number, number]
  }>({
    in: 3,
    out: 5,
    color1: [1, 1, 1],
    color2: [0, 0, 0],
  })
  const [playing, setPlaying] = createSignal(false)
  const [phase, setPhase] = createSignal<'in' | 'out'>('in')

  const direction = () => (phase() === 'in' ? 1 : -1)

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
${uniform.vec3('u_color1')}
${uniform.vec3('u_color2')}

void main() {
  if(v_uv[1] > u_value){
    outColor = vec4(u_color1, 1.0);
  }else{
    outColor = vec4(u_color2, 1.0);
  }
}`
    const { program, view } = compile.toQuad(gl, fragment, { webgl2: true })

    gl.useProgram(program)

    createEffect(() => view.uniforms.u_color1.set(...config.color1))
    createEffect(() => view.uniforms.u_color2.set(...config.color2))

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

    function renderLoop() {
      animationFrame = requestAnimationFrame(function render(time) {
        if (!playing()) {
          return
        }

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

          view.attributes.a_quad.bind()
          view.uniforms.u_value.set(current)

          gl.drawArrays(gl.TRIANGLES, 0, 6)
        } finally {
          previous = time
          requestAnimationFrame(render)
        }
      })
    }

    createEffect(() => {
      if (playing()) {
        renderLoop()
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
        <div
          style={{
            'z-index': 1,
            position: 'fixed',
            transform: 'translate(-50%, -50%)',
            top: '50vh',
            left: '50vw',
            color: 'white',
          }}
        >
          <button class={clsx(styles.button, styles.icon)} onClick={() => setPlaying(p => !p)}>
            <Show when={playing()} fallback={<AiFillPlayCircle />}>
              <AiOutlinePause />
            </Show>
          </button>
        </div>
        <section class={clsx(styles.panel, phase() === 'in' && styles.selected)}>
          <h1 class={styles.panelTitle}>IN</h1>
          <TimeControl
            value={config.in}
            onDecrement={() => setConfig('in', v => v - 0.5)}
            onIncrement={() => setConfig('in', v => v + 0.5)}
          />
        </section>
        <section class={clsx(styles.panel, phase() === 'out' && styles.selected)}>
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
