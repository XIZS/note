
class Dep{
	constructor(){
		this.subs=[];
	}
	addSub(watcher){
		this.subs.push(watcher);
	}
	notify(){
		this.subs.forEach(watcher => watcher.update());
	}
}

class Watcher{
	constructor(vm,expr,cb){
		this.vm = vm;
		this.expr = expr;
		this.cb = cb;
		this.oldValue = this.get();
	}
	get(){
		Dep.target = this;
		let value = CompileUtil.getVal(this.vm,this.expr);
		Dep.target = null;
		return value
	}
	update(){
		let newVal = CompileUtil.getVal(this.vm,this.expr);
		if(newVal !== this.oldValue){
			this.cb(newVal);
		} 
	}
}

class Observer{
	constructor(data){
		this.observer(data)
	}
	observer(data){
		if(data && typeof data==='object'){
			for(let key in data){
				this.defineReactive(data,key,data[key]);
			}
		}
	}
	defineReactive(obj,key,value){
		this.observer(value);
		let dep = new Dep();
		Object.defineProperty(obj,key,{
			get(){
				console.log(key)
				Dep.target&&dep.addSub(Dep.target);
				return value
			},
			set:(newVal)=>{
				if(newVal!=value){
					this.observer(newVal);
					value =newVal
					dep.notify();
				}
			}
		})
	}
}

class Compiler {
	constructor(el, vm) {
		this.el = this.isElementNode(el) ? el : document.querySelector(el);
		this.vm = vm
		//TODO if el !=node try error
		let fragment = this.node2fragment(this.el)

		this.compile(fragment);

		this.el.appendChild(fragment);
	}
	isDirective(attrName) {
		return attrName.startsWith('v-')
	}
	compileElement(node) {
		let attributes = node.attributes;
		[...attributes].forEach(attr => {
			let { name, value: expr } = attr;
			if (this.isDirective(name)) {
				let [, directive] = name.split('-')
				let [directiveName,eventName] = directive.split(':');
				CompileUtil[directiveName](node, expr,this.vm,eventName);
			}
		})
	}
	compileText(node) {
		let content = node.textContent;
		if (/\{\{(.+?)\}\}/.test(content)) {
			 CompileUtil['text'](node,content,this.vm)

		}
	}
	compile(node) {
		let childNode = node.childNodes;
		[...childNode].forEach(child => {
			if (this.isElementNode(child)) {
				this.compileElement(child)
				this.compile(child);
			} else {
				this.compileText(child)
			}
		})
	}
	node2fragment(node) {
		let fragment = document.createDocumentFragment();
		let firstChild;
		while (firstChild = node.firstChild) {
			fragment.appendChild(firstChild);
		}
		return fragment;
	}

	isElementNode(node) {
		return node.nodeType === 1;
	}
}
CompileUtil = {
	getVal(vm, expr) {
		return expr.split('.').reduce((prev, curr) => {
			return prev[curr]
		}, vm.$data)
	},
	setVal(vm,expr,value){
		expr.split('.').reduce((prev,curr,index,arr)=>{
			if(index===arr.length-1){
				prev[curr] = value
			}
			return prev[curr]
		},vm.$data)
	},
	on(node,expr,vm,eventName){
		node.addEventListener(eventName,(e)=>{
			
			vm[expr].call(vm,e);
		})
	},
	html(node,expr,vm){
		let fn = this.updater['htmlUpdater'];
		new Watcher(vm,expr,(newVal)=>{
			fn(node,newVal);
		});
		let value = this.getVal(vm,expr);
		fn(node,value);
	},
	model(node, expr, vm) {
		let fn = this.updater['modeUpdater']

		new Watcher(vm,expr,(newVal)=>{//当当前对象发生变化时候执行以下方法
			fn(node,newVal);
		})
		node.addEventListener('input',(e)=>{
			let value =e.target.value;
			this.setVal(vm,expr,value);
		})
		let value = this.getVal(vm,expr);
		fn(node,value);
	},
	getContentValue(vm,expr){
		return expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
			return this.getVal(vm,args[1])
		})
	},
	text(node,expr,vm){
		let fn = this.updater['textUpdater']
		let content =expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
			new Watcher(vm,args[1],(newVal)=>{
				fn(node,this.getContentValue(vm,expr))
			})
			return this.getVal(vm,args[1])
		})
		fn(node,content);
	},
	updater:{
		htmlUpdater(node,value){
			node.innerHTML = value;
		},
		modeUpdater(node,value){
			node.value = value;
		},
		textUpdater(node,value){
			node.textContent = value
		}
	}
}
class Vue {
	constructor(options) {
		this.$el = options.el;
		this.$data = options.data;
		let computed = options.computed;
		let methods = options.methods;
		if (this.$el) {
			new Observer(this.$data);
			for(let key in computed){
				Object.defineProperty(this.$data,key,{
					get:()=>{
						return computed[key].call(this);
					}
				})
			}
			for(let key in methods){
				Object.defineProperty(this,key,{
					get(){
						return methods[key];
					}
				})
			}
			this.proxyVm(this.$data)
			new Compiler(this.$el, this)
		}
	}
	proxyVm(data){
		for(let key in data){
			Object.defineProperty(this,key,{
				get(){
					return data[key]
				},
				set(newVal){
					data[key] = newVal;
				}
			})
		}
	}
}
