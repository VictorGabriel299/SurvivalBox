let chunk=null

let blockJsons=[]
let geometries={}
let blockMaterials={}
let transparentBlocksID=[]
let worldHeight=0
let materialList=[]
let matToIndex={}

function initMesher(data){
    worldHeight=data.worldHeight
    blockJsons=data.blockJsons
    geometries=data.geometries
    blockMaterials=data.blockMaterials
    transparentBlocksID=data.transparentBlocksID
    updateMaterials()
}

const blockSize=32
const chunkSize=16
const chunkArea=256

const directions=[
   [1,0,0],
   [-1,0,0],
   [0,1,0],
   [0,-1,0],
   [0,0,1],
   [0,0,-1]
]

const blockFaceRotations={
   north:["west","south","east","down"],
   east:["north","west","south","east","south","west","north"],
   south:["east","north","west","up"],
   west:["south","east","north","west","north","east","south"],
   up:["up","up","up","north","east","south","west"],
   down:["down","down","down","south","west","north","east"]
}

const facingNames=[
   "north",
   "east",
   "south",
   "west",
   "up",
   "down"
]

function updateMaterials(){
   const keys=Object.keys(blockMaterials)

   materialList=Object.values(blockMaterials)
   matToIndex=Object.create(null)

   for(let i=0;i<keys.length;i++){
      matToIndex[keys[i]]=i
   }
}

function getBlock(x,y,z){
   if(!chunk?.blocks)return 0n

   if(
      x<0||
      x>=chunkSize||
      z<0||
      z>=chunkSize||
      y<0||
      y>=worldHeight
   ){
      return 0n
   }

   return chunk.blocks[
      (y<<8)+(z<<4)+x
   ]||0n
}

function getBlockID(data){
   return Number(
      (BigInt(data)>>34n)&0x3FFFn
   )
}

function parseBlock(data){
   const n=BigInt(data)

   return{
      id:Number((n>>34n)&0x3FFFn),
      texture:Number((n>>28n)&0x3Fn),
      facing:Number((n>>25n)&0x7n),

      b1:Number((n>>24n)&1n),
      b2:Number((n>>23n)&1n),
      b3:Number((n>>22n)&1n),
      b4:Number((n>>21n)&1n),

      v1:Number((n>>14n)&0x7Fn),
      v2:Number((n>>7n)&0x7Fn),
      v3:Number(n&0x7Fn)
   }
}

function getClimate(x,z){
   const i=(z<<4)+x

   return{
      temp:chunk?.temp?.[i],
      hum:chunk?.hum?.[i]
   }
}

function evaluateCondition(condition,block,x,z){
   if(!condition)return true

   try{
      const climate=getClimate(x,z)

      const context={
         ...block,
         ...climate
      }

      const fn=new Function(
         ...Object.keys(context),
         `return ${condition}`
      )

      return !!fn(
         ...Object.values(context)
      )
   }catch{
      return false
   }
}

function getBlockJson(block,x,z){
   const base=blockJsons[block.id]

   if(!base)return null

   const result={
      definitions:{
         ...(base.definitions||{})
      },
      behavior:{
         ...(base.behavior||{})
      },
      triggers:{
         ...(base.triggers||{})
      }
   }

   if(base.states){
      for(const state of base.states){
         if(!evaluateCondition(
            state.conditions,
            block,
            x,
            z
         )){
            continue
         }

         if(state.definitions){
            Object.assign(
               result.definitions,
               state.definitions
            )
         }

         if(state.behavior){
            Object.assign(
               result.behavior,
               state.behavior
            )
         }
      }
   }

   return result
}

function isTransparent(data){
   if(!data)return true

   return !!transparentBlocksID[
      getBlockID(data)
   ]
}

function isVisible(x,y,z){
   if(!getBlock(x,y,z))return false

   return(
      isTransparent(getBlock(x+1,y,z))||
      isTransparent(getBlock(x-1,y,z))||
      isTransparent(getBlock(x,y+1,z))||
      isTransparent(getBlock(x,y-1,z))||
      isTransparent(getBlock(x,y,z+1))||
      isTransparent(getBlock(x,y,z-1))
   )
}

function getGreedyBlockType(
   x,
   y,
   z,
   face
){
   const data=getBlock(x,y,z)

   if(!data)return null

   const block=parseBlock(data)

   const json=getBlockJson(
      block,
      x,
      z
   )

   if(
      !json||
      json.definitions.geometry!=="block"
   ){
      return null
   }

   const textures=json.definitions.textures

   const rotation=
      blockFaceRotations[
         facingNames[block.facing-1]
      ]

   if(rotation){
      const faceIndex=
         facingNames.indexOf(face)

      if(faceIndex!==-1){
         face=
            rotation[faceIndex]||
            face
      }
   }

   return(
      textures?.[face]?.[block.texture]||
      textures?.[block.texture]||
      null
   )
}

function buildChunkMesh(){
   if(!chunk?.blocks)return null

   worldHeight=
      chunk.height??
      chunk.worldHeight??
      (chunk.blocks.length/chunkArea)

   updateMaterials()

   const positions=[]
   const normals=[]
   const uvs=[]
   const indices=[]
   const groups={}

   let indexCount=0

   const dims=[
      chunkSize,
      worldHeight,
      chunkSize
   ]

   for(let d=0;d<3;d++){
      const u=(d+1)%3
      const v=(d+2)%3

      const x=[0,0,0]
      const q=[0,0,0]

      const mask=new Int32Array(
         dims[u]*dims[v]
      )

      let face1
      let face2

      if(d===0){
         face1="east"
         face2="west"
      }else if(d===1){
         face1="up"
         face2="down"
      }else{
         face1="south"
         face2="north"
      }

      q[d]=1

      for(x[d]=-1;x[d]<dims[d];){
         let n=0

         for(x[v]=0;x[v]<dims[v];x[v]++){
            for(x[u]=0;x[u]<dims[u];x[u]++){
               const x0=x[0]
               const y0=x[1]
               const z0=x[2]

               const b1=getGreedyBlockType(
                  x0,
                  y0,
                  z0,
                  face1
               )

               const b2=getGreedyBlockType(
                  x0+q[0],
                  y0+q[1],
                  z0+q[2],
                  face2
               )

               const m1=
                  b1!==null&&
                  matToIndex[b1]!==undefined
                     ?matToIndex[b1]+1
                     :0

               const m2=
                  b2!==null&&
                  matToIndex[b2]!==undefined
                     ?matToIndex[b2]+1
                     :0

               if(m1===m2){
                  mask[n]=0
               }else if(m1){
                  mask[n]=m1
               }else{
                  mask[n]=-m2
               }

               n++
            }
         }

         x[d]++
         n=0

         for(let j=0;j<dims[v];j++){
            for(let i=0;i<dims[u];){
               const c=mask[n]

               if(c===0){
                  i++
                  n++
                  continue
               }

               let w=1

               while(
                  i+w<dims[u]&&
                  mask[n+w]===c
               ){
                  w++
               }

               let h=1

               for(;j+h<dims[v];h++){
                  let done=false

                  for(let k=0;k<w;k++){
                     if(
                        mask[
                           n+
                           k+
                           h*dims[u]
                        ]!==c
                     ){
                        done=true
                        break
                     }
                  }

                  if(done)break
               }

               const isFront=c>0
               const matIdx=Math.abs(c)-1

               x[u]=i
               x[v]=j

               const du=[0,0,0]
               const dv=[0,0,0]

               du[u]=w
               dv[v]=h

               const bl=[
                  x[0],
                  x[1],
                  x[2]
               ]

               const br=[
                  x[0]+du[0],
                  x[1]+du[1],
                  x[2]+du[2]
               ]

               const tr=[
                  x[0]+du[0]+dv[0],
                  x[1]+du[1]+dv[1],
                  x[2]+du[2]+dv[2]
               ]

               const tl=[
                  x[0]+dv[0],
                  x[1]+dv[1],
                  x[2]+dv[2]
               ]

               const bLeft=[
                  bl[0]*blockSize,
                  bl[1]*blockSize,
                  bl[2]*blockSize
               ]

               const bRight=[
                  br[0]*blockSize,
                  br[1]*blockSize,
                  br[2]*blockSize
               ]

               const tRight=[
                  tr[0]*blockSize,
                  tr[1]*blockSize,
                  tr[2]*blockSize
               ]

               const tLeft=[
                  tl[0]*blockSize,
                  tl[1]*blockSize,
                  tl[2]*blockSize
               ]

               if(isFront){
                  positions.push(
                     ...bLeft,
                     ...bRight,
                     ...tRight,
                     ...tLeft
                  )
               }else{
                  positions.push(
                     ...bLeft,
                     ...tLeft,
                     ...tRight,
                     ...bRight
                  )
               }

               const normal=[
                  0,
                  0,
                  0
               ]

               normal[d]=
                  isFront
                     ?1
                     :-1

               normals.push(
                  ...normal,
                  ...normal,
                  ...normal,
                  ...normal
               )

               const sizeU=
                  du[u]||
                  dv[u]

               const sizeV=
                  du[v]||
                  dv[v]

               const u1=sizeU
               const v1=sizeV

               if(d===0){
                  if(isFront){
                     uvs.push(
                        0,0,
                        0,u1,
                        v1,u1,
                        v1,0
                     )
                  }else{
                     uvs.push(
                        0,0,
                        v1,0,
                        v1,u1,
                        0,u1
                     )
                  }
               }else{
                  if(isFront){
                     uvs.push(
                        0,0,
                        u1,0,
                        u1,v1,
                        0,v1
                     )
                  }else{
                     uvs.push(
                        0,0,
                        0,v1,
                        u1,v1,
                        u1,0
                     )
                  }
               }

               indices.push(
                  indexCount,
                  indexCount+1,
                  indexCount+2,

                  indexCount,
                  indexCount+2,
                  indexCount+3
               )

               if(!groups[matIdx]){
                  groups[matIdx]=[]
               }

               groups[matIdx].push({
                  start:indices.length-6,
                  count:6
               })

               indexCount+=4

               for(let l=0;l<h;l++){
                  for(let k=0;k<w;k++){
                     mask[
                        n+
                        k+
                        l*dims[u]
                     ]=0
                  }
               }

               i+=w
               n+=w
            }
         }
      }
   }
   for(let x=0;x<chunkSize;x++){
      for(let z=0;z<chunkSize;z++){
         for(let y=0;y<worldHeight;y++){
            const data=getBlock(x,y,z)

            if(!data)continue

            if(!isVisible(x,y,z))continue

            const block=parseBlock(data)

            const json=getBlockJson(
               block,
               x,
               z
            )

            const geometryType=
               json?.definitions?.geometry

            if(
               geometryType==="block"||
               !geometryType
            ){
               continue
            }

            const geoData=
               geometries[geometryType]

            if(!geoData)continue

            const texture=
               json?.definitions?.textures?.[
                  block.texture
               ]

            const material=
               blockMaterials[texture]

            if(material===undefined)continue

            const matIdx=
               matToIndex[texture]

            if(matIdx===undefined)continue

            const posAttr=
               geoData.attributes?.position

            const normAttr=
               geoData.attributes?.normal

            const uvAttr=
               geoData.attributes?.uv

            const idxAttr=
               geoData.index

            if(!posAttr)continue

            const offsetX=
               x*blockSize+
               blockSize/2

            const offsetY=
               y*blockSize

            const offsetZ=
               z*blockSize+
               blockSize/2

            const startIndex=indexCount
            const vertexCount=posAttr.count

            for(let i=0;i<vertexCount;i++){
               positions.push(
                  posAttr.getX(i)+offsetX,
                  posAttr.getY(i)+offsetY,
                  posAttr.getZ(i)+offsetZ
               )

               if(normAttr){
                  normals.push(
                     normAttr.getX(i),
                     normAttr.getY(i),
                     normAttr.getZ(i)
                  )
               }else{
                  normals.push(
                     0,
                     1,
                     0
                  )
               }

               if(uvAttr){
                  uvs.push(
                     uvAttr.getX(i),
                     uvAttr.getY(i)
                  )
               }else{
                  uvs.push(
                     0,
                     0
                  )
               }
            }

            const addedIndices=
               idxAttr?
                  idxAttr.count:
                  vertexCount

            if(idxAttr){
               for(let i=0;i<idxAttr.count;i++){
                  indices.push(
                     idxAttr.getX(i)+
                     startIndex
                  )
               }
            }else{
               for(let i=0;i<vertexCount;i++){
                  indices.push(
                     startIndex+i
                  )
               }
            }

            if(!groups[matIdx]){
               groups[matIdx]=[]
            }

            groups[matIdx].push({
               start:
                  indices.length-
                  addedIndices,
               count:
                  addedIndices
            })

            indexCount+=vertexCount
         }
      }
   }

   const finalGroups=[]

   for(const key in groups){
      const list=groups[key]

      if(!list.length)continue

      const materialIndex=Number(key)

      let start=list[0].start
      let count=list[0].count

      for(let i=1;i<list.length;i++){
         const current=list[i]

         if(
            current.start===
            start+count
         ){
            count+=current.count
         }else{
            finalGroups.push({
               start,
               count,
               materialIndex
            })

            start=current.start
            count=current.count
         }
      }

      finalGroups.push({
         start,
         count,
         materialIndex
      })
   }

   const IndexArray=
      indexCount>65535
         ?Uint32Array
         :Uint16Array

   return{
      positions:new Float32Array(positions),
      normals:new Float32Array(normals),
      uvs:new Float32Array(uvs),
      indices:new IndexArray(indices),

      groups:finalGroups,

      vertexCount:indexCount,
      indexCount:indices.length
   }
}

onmessage=(event)=>{
  const ev=event.data
  if(ev.quest==="init")initMesher(ev.data)
  else if(ev.quest==="mesh"){
     chunk=ev.data.chunk
     const result=buildChunkMesh()
     postMessage(
        result,
        [
           result.positions.buffer,
           result.normals.buffer,
           result.uvs.buffer,
           result.indices.buffer
        ]
     )
  }
}