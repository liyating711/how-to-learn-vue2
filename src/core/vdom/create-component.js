import VNode from './vnode'
import { resolveConstructorOptions } from '../instance/init'
import { updateChildComponent } from '../instance/lifecycle'
import {
  warn,
  isObject,
  hasOwn,
  hyphenate,
} from '../util/index'


// 在_c('my-component')时调用createComponent生成vnode
// 通过Vue.extend出来的孩子构造器生成vnode
export function createComponent (Ctor, data, context, children, tag) {
  if (!Ctor) {
    return
  }

  if (typeof Ctor !== 'function') {
    warn(`Invalid Component definition: ${String(Ctor)}`, context)
    return
  }

  // 重新merge一下options
  resolveConstructorOptions(Ctor)

  data = data || {}

  // 得到父亲传给孩子的属性
  const propsData = extractProps(data, Ctor)

  mergeHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag

  // 生成一个特殊的vnode 带有
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, tag, children }
  )
  return vnode
}

export function createComponentInstanceForVnode (
  vnode,
  parentElm,
  refElm
) {
  const vnodeComponentOptions = vnode.componentOptions
  const options = {
    _isComponent: true,
    propsData: vnodeComponentOptions.propsData,
    _componentTag: vnodeComponentOptions.tag,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }

  // 通过构造器生成子组件vm实例
  return new vnodeComponentOptions.Ctor(options)
}

// initComponentAndMount和prepatch等操作放在vnode.hook，
// 否则会有循环依赖
const hooks = { init, prepatch }
const hooksToMerge = Object.keys(hooks)

// 在patch createElem的时候创建组件
// 原来的initComponentAndMount 改名为 init
export function init (vnode, parentElm, refElm) {
  if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
    const child = vnode.componentInstance = createComponentInstanceForVnode(
      vnode,
      parentElm,
      refElm
    )
    // 可以看到 createComponentInstanceForVnode 已经把要塞入的parentElem 和相对位置 refElme都放到构造器的options参数
    // 这个时候直接 $mount 会触发 子组件vm对象收集依赖 同时触发 _update去patch vnode生成
    // 见 patch.js patch函数的 if (!oldVode) 逻辑。
    child.$mount(vnode.elm || undefined)
  }
}

// 当父亲vnode传递过来的props变化的时候，需要更新组件内部
export function prepatch (oldVnode, vnode) {
  const options = vnode.componentOptions
  const child = vnode.componentInstance = oldVnode.componentInstance // 直接更新之前的子组件vm的props即可
  updateChildComponent(child, options.propsData)
}

function extractProps (data, Ctor) {
  // we are only extracting raw values here.
  // validation and default values are handled in the child
  // component itself.
  const propOptions = Ctor.options.props // 拿出构造器的options参数
  if (!propOptions) {
    return
  }
  const res = {}
  const { attrs, props, domProps } = data
  if (attrs || props || domProps) {
    for (const key in propOptions) {
      const altKey = hyphenate(key)
      // <div MyProp="">  => <div my-prop="">
      // key="altKey"  altKey="my-prop"

      // 从父亲vm的props等
      checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey) ||
      checkProp(res, domProps, key, altKey)
    }
  }
  return res
}

/*
  检查类型

  props: {
    // 基础类型检测 (`null` 意思是任何类型都可以)
    propA: Number,
    // 多种类型
    propB: [String, Number],
    // 必传且是字符串
    propC: {
      type: String,
      required: true
    },
    // 数字，有默认值
    propD: {
      type: Number,
      default: 100
    },
    // 数组/对象的默认值应当由一个工厂函数返回
    propE: {
      type: Object,
      default: function () {
        return { message: 'hello' }
      }
    },
    // 自定义验证函数
    propF: {
      validator: function (value) {
        return value > 10
      }
    }
  }
*/
function checkProp (res, hash, key, altKey, preserve) {
  // key="altKey"  altKey="my-prop"
  if (hash) {
    if (hasOwn(hash, key)) {
      res[key] = hash[key]
      if (!preserve) { // 如果从props
        delete hash[key]
      }
      return true
    } else if (hasOwn(hash, altKey)) {
      res[key] = hash[altKey]
      if (!preserve) {
        delete hash[altKey]
      }
      return true
    }
  }
  return false
}

function mergeHooks (data) {
  if (!data.hook) {
    data.hook = {}
  }
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    data.hook[key] = hooks[key]
  }
}