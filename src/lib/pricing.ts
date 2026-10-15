import type {Product} from "./catalog.ts";
export type Selection={variantId:string;options:Record<string,string[]>};
export function calculateLine(product:Product,selection:Selection,quantity:number){
 if(!product.available) throw new Error("Este producto no está disponible.");
 if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error("Cantidad inválida.");
 const variant=product.variants.find(v=>v.id===selection.variantId);if(!variant)throw new Error("Selecciona una variante válida.");
 let unitPrice=variant.price;const labels=[variant.name];
 for(const groupId of Object.keys(selection.options))if(!product.groups.some(g=>g.id===groupId))throw new Error("Grupo de opciones inválido.");
 for(const g of product.groups){const ids=selection.options[g.id]??[];if(new Set(ids).size!==ids.length)throw new Error("Opción repetida.");if(ids.length<g.min||ids.length>g.max)throw new Error(`Revisa las opciones de ${g.name}.`);for(const id of ids){const option=g.options.find(o=>o.id===id);if(!option)throw new Error("Opción inválida.");unitPrice+=option.price;labels.push(option.name);}}
 return {unitPrice,total:unitPrice*quantity,labels};
}
export function selectionKey(productId:string,selection:Selection){return JSON.stringify([productId,selection.variantId,Object.keys(selection.options).sort().map(k=>[k,[...selection.options[k]].sort()])]);}
