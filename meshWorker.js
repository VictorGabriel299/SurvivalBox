let chunk=null

let chunkCX=0
let chunkCZ=0

let blockJsons=[]
let geometries={}
let blockMaterials={}
let transparentBlocksID=[]
let worldHeight=0
let materialList=[]
let matToIndex={}

let blockCache=null
let faceMaterials=null

let conditionCache=new Map()

function initMesher(data){
   worldHeight=data.worldHeight
   blockJsons=data.blockJsons
   geometries=data.geometries
   blockMaterials=data.blockMaterials
   transparentBlocksID=data.transparentBlocksID
   updateMaterials()

   conditionCache.clear()
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

const faceIndices={
   east:0,
   west:1,
   up:2,
   down:3,
   south:4,
   north:5
}

const facingNames=[
   "north",
   "east",
   "south",
   "west",
   "up",
   "down"
]

const blockFaceRotations={
   north:["west","south","east","down"],
   east:["north","west","south","east","south","west","north"],
   south:["east","north","west","up"],
   west:["south","east","north","west","north","east","south"],
   up:["up","up","up","north","east","south","west"],
   down:["down","down","down","south","west","north","east"]
}

const directionFaces=[
   "east",
   "west",
   "up",
   "down",
   "south",
   "north"
]

function updateMaterials(){
   const keys=Object.keys(blockMaterials)

   materialList=Object.values(blockMaterials)
   matToIndex=Object.create(null)

   for(let i=0;i<keys.length;i++){
      matToIndex[keys[i]]=i
   }
}

function getMaterialIndex(texture){
   if(texture===undefined||texture===null)
      return -1

   let index=matToIndex[texture]

   if(index!==undefined)
      return index

   const material=blockMaterials[texture]

   if(material===undefined)
      return -1

   index=materialList.length

   materialList.push(material)
   matToIndex[texture]=index

   return index
}

function getBlockIndex(x,y,z){
   return(
      (y<<8)+
      (z<<4)+
      x
   )
}

function getBlock(x,y,z){
   if(!chunk?.blocks)
      return 0n

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

function getConditionFunction(condition){
   if(!condition)
      return null

   let fn=conditionCache.get(condition)

   if(fn!==undefined)
      return fn

   try{
      fn=new Function(
         "id",
         "texture",
         "facing",
         "b1",
         "b2",
         "b3",
         "b4",
         "v1",
         "v2",
         "v3",
         "temp",
         "hum",
         "x",
         "y",
         "z",
         "worldX",
         "worldY",
         "worldZ",
         `return !!(${condition})`
      )
   }catch{
      fn=false
   }

   conditionCache.set(condition,fn)

   return fn
}

function evaluateCondition(
   condition,
   block,
   x,
   y,
   z
){
   if(!condition)return true

   const fn=getConditionFunction(condition)

   if(!fn||fn===false)
      return false

   try{
      const climateIndex=
         (z<<4)+x

      const temp=
         chunk?.temp?.[climateIndex]

      const hum=
         chunk?.hum?.[climateIndex]

      const worldX=
         (chunkCX<<4)+x

      const worldZ=
         (chunkCZ<<4)+z

      return fn(
         block.id,
         block.texture,
         block.facing,
         block.b1,
         block.b2,
         block.b3,
         block.b4,
         block.v1,
         block.v2,
         block.v3,
         temp,
         hum,
         worldX,
         y,
         worldZ,
         worldX,
         y,
         worldZ
      )
   }catch{
      return false
   }
}

function getBlockJson(
   block,
   x,
   y,
   z
){
   const base=blockJsons[block.id]

   if(!base)return null

   let result=base

   if(base.states){
      result={
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

      for(const state of base.states){
         if(!evaluateCondition(
            state.conditions,
            block,
            x,
            y,
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

         if(state.triggers){
            Object.assign(
               result.triggers,
               state.triggers
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

function prepareChunkCache(){
   const total=
      chunkSize*
      worldHeight*
      chunkSize

   blockCache=new Array(total)
   faceMaterials=new Int32Array(
      total*6
   )

   for(let y=0;y<worldHeight;y++){
      for(let z=0;z<chunkSize;z++){
         const row=
            (y<<8)+(z<<4)

         for(let x=0;x<chunkSize;x++){
            const index=row+x
            const data=
               chunk.blocks[index]||0n

            if(!data)
               continue

            const block=parseBlock(data)

            const json=getBlockJson(
               block,
               x,
               y,
               z
            )

            if(!json){
               blockCache[index]={
                  data,
                  block,
                  json:null,
                  geometry:null
               }
               continue
            }

            const geometry=
               json.definitions?.geometry

            blockCache[index]={
               data,
               block,
               json,
               geometry
            }

            if(geometry!=="block")
               continue

            const textures=
               json.definitions?.textures

            if(!textures)
               continue

            const facing=
               facingNames[
                  block.facing-1
               ]

            const rotation=
               blockFaceRotations[facing]

            const base=
               index*6

            for(let face=0;face<6;face++){
               let textureFace=
                  directionFaces[face]

               if(rotation){
                  textureFace=
                     rotation[face]||
                     textureFace
               }

               const texture=
                  textures[textureFace]?.[
                     block.texture
                  ]||
                  textures[block.texture]||
                  null

               if(texture!==null){
                  const mat=
                     getMaterialIndex(texture)

                  if(mat!==-1){
                     faceMaterials[
                        base+face
                     ]=mat+1
                  }
               }
            }
         }
      }
   }
}

function getCachedBlock(
   x,
   y,
   z
){
   if(
      x<0||
      x>=chunkSize||
      y<0||
      y>=worldHeight||
      z<0||
      z>=chunkSize
   ){
      return null
   }

   return blockCache[
      (y<<8)+(z<<4)+x
   ]||null
}

function isVisibleCached(
   x,
   y,
   z,
   data
){
   if(!data)
      return false

   const i=
      (y<<8)+(z<<4)+x

   const east=
      x===chunkSize-1
         ?0n
         :chunk.blocks[i+1]||0n

   const west=
      x===0
         ?0n
         :chunk.blocks[i-1]||0n

   const up=
      y===worldHeight-1
         ?0n
         :chunk.blocks[i+256]||0n

   const down=
      y===0
         ?0n
         :chunk.blocks[i-256]||0n

   const south=
      z===chunkSize-1
         ?0n
         :chunk.blocks[i+16]||0n

   const north=
      z===0
         ?0n
         :chunk.blocks[i-16]||0n

   return(
      !east||
      !west||
      !up||
      !down||
      !south||
      !north||
      isTransparent(east)||
      isTransparent(west)||
      isTransparent(up)||
      isTransparent(down)||
      isTransparent(south)||
      isTransparent(north)
   )
}

function getGreedyMaterial(
   x,
   y,
   z,
   face
){
   if(
      x<0||
      x>=chunkSize||
      y<0||
      y>=worldHeight||
      z<0||
      z>=chunkSize
   ){
      return 0
   }

   const faceIndex=
      faceIndices[face]

   if(faceIndex===undefined)
      return 0

   return faceMaterials[
      ((y<<8)+(z<<4)+x)*6+
      faceIndex
   ]
}

function getGreedyBlockType(
   x,
   y,
   z,
   face
){
   const material=
      getGreedyMaterial(
         x,
         y,
         z,
         face
      )

   if(!material)
      return null

   return material
}

function getGreedyMaterialIndex(
   texture
){
   if(!texture)
      return 0

   return texture
}

function buildChunkMesh(){
   if(!chunk?.blocks)
      return null

   prepareChunkCache()

   const positions=[]
   const normals=[]
   const uvs=[]
   const indices=[]

   const groupStarts={}
   const groupCounts={}

   let indexCount=0

   const dims=[
      chunkSize,
      worldHeight,
      chunkSize
   ]

   for(let d=0;d<3;d++){
      const u=(d+1)%3
      const v=(d+2)%3

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

      const q0=
         d===0?1:0

      const q1=
         d===1?1:0

      const q2=
         d===2?1:0

      const x=[0,0,0]

      for(x[d]=-1;x[d]<dims[d];){
         let n=0

         for(x[v]=0;x[v]<dims[v];x[v]++){
            for(x[u]=0;x[u]<dims[u];x[u]++){
               const x0=x[0]
               const y0=x[1]
               const z0=x[2]

               const m1=
                  getGreedyMaterial(
                     x0,
                     y0,
                     z0,
                     face1
                  )

               const m2=
                  getGreedyMaterial(
                     x0+q0,
                     y0+q1,
                     z0+q2,
                     face2
                  )

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
                  const row=
                     n+
                     h*dims[u]

                  let valid=true

                  for(let k=0;k<w;k++){
                     if(mask[row+k]!==c){
                        valid=false
                        break
                     }
                  }

                  if(!valid)
                     break
               }

               const isFront=c>0
               const matIdx=
                  Math.abs(c)-1

               x[u]=i
               x[v]=j

               const duU=w
               const dvV=h

               const x0=x[0]
               const y0=x[1]
               const z0=x[2]

               const rx=
                  x0+
                  (u===0?duU:0)+
                  (v===0?dvV:0)

               const ry=
                  y0+
                  (u===1?duU:0)+
                  (v===1?dvV:0)

               const rz=
                  z0+
                  (u===2?duU:0)+
                  (v===2?dvV:0)

               const blx=
                  x0*blockSize
               const bly=
                  y0*blockSize
               const blz=
                  z0*blockSize

               const brx=
                  (
                     x0+
                     (u===0?w:0)
                  )*blockSize

               const bry=
                  (
                     y0+
                     (u===1?w:0)
                  )*blockSize

               const brz=
                  (
                     z0+
                     (u===2?w:0)
                  )*blockSize

               const trx=
                  rx*blockSize

               const try_=
                  ry*blockSize

               const trz=
                  rz*blockSize

               const tlx=
                  (
                     x0+
                     (v===0?h:0)
                  )*blockSize

               const tly=
                  (
                     y0+
                     (v===1?h:0)
                  )*blockSize

               const tlz=
                  (
                     z0+
                     (v===2?h:0)
                  )*blockSize

               if(isFront){
                  positions.push(
                     blx,bly,blz,
                     brx,bry,brz,
                     trx,try_,trz,
                     tlx,tly,tlz
                  )
               }else{
                  positions.push(
                     blx,bly,blz,
                     tlx,tly,tlz,
                     trx,try_,trz,
                     brx,bry,brz
                  )
               }

               const normalX=
                  d===0
                     ?isFront?1:-1
                     :0

               const normalY=
                  d===1
                     ?isFront?1:-1
                     :0

               const normalZ=
                  d===2
                     ?isFront?1:-1
                     :0

               normals.push(
                  normalX,normalY,normalZ,
                  normalX,normalY,normalZ,
                  normalX,normalY,normalZ,
                  normalX,normalY,normalZ
               )

               const sizeU=
                  u===0?w:
                  u===1?w:
                  u===2?w:
                  0

               const sizeV=
                  v===0?h:
                  v===1?h:
                  v===2?h:
                  0

               if(d===0){
                  if(isFront){
                     uvs.push(
                        0,0,
                        0,sizeU,
                        sizeV,sizeU,
                        sizeV,0
                     )
                  }else{
                     uvs.push(
                        0,0,
                        sizeV,0,
                        sizeV,sizeU,
                        0,sizeU
                     )
                  }
               }else{
                  if(isFront){
                     uvs.push(
                        0,0,
                        sizeU,0,
                        sizeU,sizeV,
                        0,sizeV
                     )
                  }else{
                     uvs.push(
                        0,0,
                        0,sizeV,
                        sizeU,sizeV,
                        sizeU,0
                     )
                  }
               }

               const start=
                  indexCount

               indices.push(
                  start,
                  start+1,
                  start+2,
                  start,
                  start+2,
                  start+3
               )

               if(groupStarts[matIdx]===undefined){
                  groupStarts[matIdx]=[]
                  groupCounts[matIdx]=[]
               }

               groupStarts[matIdx].push(
                  indices.length-6
               )

               groupCounts[matIdx].push(6)

               indexCount+=4

               for(let l=0;l<h;l++){
                  const row=
                     n+
                     l*dims[u]

                  for(let k=0;k<w;k++){
                     mask[row+k]=0
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
            const voxelIndex=
               (y<<8)+(z<<4)+x

            const cached=
               blockCache[voxelIndex]

            if(!cached)
               continue

            const geometryType=
               cached.geometry

            if(
               geometryType==="block"||
               !geometryType
            ){
               continue
            }

            if(
               !isVisibleCached(
                  x,
                  y,
                  z,
                  cached.data
               )
            ){
               continue
            }

            const geoData=
               geometries[geometryType]

            if(!geoData)
               continue

            const block=
               cached.block

            const json=
               cached.json

            const texture=
               json.definitions?.textures?.[
                  block.texture
               ]

            const matIdx=
               getMaterialIndex(texture)

            if(matIdx===-1)
               continue

            const posAttr=
               geoData.position

            const normAttr=
               geoData.normal

            const uvAttr=
               geoData.uv

            const idxAttr=
               geoData.index

            if(!posAttr)
               continue

            const vertexCount=
               geoData.vertexCount

            const offsetX=
               x*blockSize+
               blockSize/2

            const offsetY=
               y*blockSize

            const offsetZ=
               z*blockSize+
               blockSize/2

            const startIndex=
               indexCount

            for(let i=0;i<vertexCount;i++){
               const p=i*3

               positions.push(
                  posAttr[p]+offsetX,
                  posAttr[p+1]+offsetY,
                  posAttr[p+2]+offsetZ
               )

               if(normAttr){
                  normals.push(
                     normAttr[p],
                     normAttr[p+1],
                     normAttr[p+2]
                  )
               }else{
                  normals.push(
                     0,1,0
                  )
               }

               if(uvAttr){
                  const uv=i*2

                  uvs.push(
                     uvAttr[uv],
                     uvAttr[uv+1]
                  )
               }else{
                  uvs.push(
                     0,0
                  )
               }
            }

            const addedIndices=
               idxAttr?
                  idxAttr.length:
                  vertexCount

            if(idxAttr){
               for(let i=0;i<idxAttr.length;i++){
                  indices.push(
                     idxAttr[i]+
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

            if(groupStarts[matIdx]===undefined){
               groupStarts[matIdx]=[]
               groupCounts[matIdx]=[]
            }

            groupStarts[matIdx].push(
               indices.length-
               addedIndices
            )

            groupCounts[matIdx].push(
               addedIndices
            )

            indexCount+=vertexCount
         }
      }
   }

   const finalGroups=[]

   for(const key in groupStarts){
      const starts=
         groupStarts[key]

      const counts=
         groupCounts[key]

      if(!starts.length)
         continue

      const materialIndex=
         Number(key)

      let start=starts[0]
      let count=counts[0]

      for(let i=1;i<starts.length;i++){
         const currentStart=
            starts[i]

         const currentCount=
            counts[i]

         if(
            currentStart===
            start+count
         ){
            count+=currentCount
         }else{
            finalGroups.push({
               start,
               count,
               materialIndex
            })

            start=currentStart
            count=currentCount
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
      cx:chunkCX,
      cz:chunkCZ,

      positions:new Float32Array(positions),
      normals:new Float32Array(normals),
      uvs:new Float32Array(uvs),
      indices:new IndexArray(indices),

      groups:finalGroups,

      vertexCount:indexCount,
      indexCount:indices.length,

      bounds:{
         min:{
            x:0,
            y:0,
            z:0
         },
         max:{
            x:chunkSize*blockSize,
            y:worldHeight*blockSize,
            z:chunkSize*blockSize
         }
      }
   }
}

function refreshChunkMesh(x,y,z,oldMesh){
   if(!chunk?.blocks||!oldMesh)return null

   const minX=Math.max(0,((x>>3)<<3)-1)
   const minY=Math.max(0,((y>>3)<<3)-1)
   const minZ=Math.max(0,((z>>3)<<3)-1)

   const maxX=Math.min(chunkSize,((x>>3)<<3)+9)
   const maxY=Math.min(worldHeight,((y>>3)<<3)+9)
   const maxZ=Math.min(chunkSize,((z>>3)<<3)+9)

   const positions=[]
   const normals=[]
   const uvs=[]
   const indices=[]
   const groups=[]

   let vertexCount=0

   const oldPositions=oldMesh.positions
   const oldNormals=oldMesh.normals
   const oldUvs=oldMesh.uvs
   const oldIndices=oldMesh.indices

   for(const group of oldMesh.groups){
      const groupStart=group.start
      const groupEnd=group.start+group.count

      let newStart=-1
      let newCount=0

      for(let i=groupStart;i<groupEnd;i+=3){
         const ia=oldIndices[i]
         const ib=oldIndices[i+1]
         const ic=oldIndices[i+2]

         const a=ia*3
         const b=ib*3
         const c=ic*3

         const triMinX=Math.min(
            oldPositions[a],
            oldPositions[b],
            oldPositions[c]
         )

         const triMinY=Math.min(
            oldPositions[a+1],
            oldPositions[b+1],
            oldPositions[c+1]
         )

         const triMinZ=Math.min(
            oldPositions[a+2],
            oldPositions[b+2],
            oldPositions[c+2]
         )

         const triMaxX=Math.max(
            oldPositions[a],
            oldPositions[b],
            oldPositions[c]
         )

         const triMaxY=Math.max(
            oldPositions[a+1],
            oldPositions[b+1],
            oldPositions[c+1]
         )

         const triMaxZ=Math.max(
            oldPositions[a+2],
            oldPositions[b+2],
            oldPositions[c+2]
         )

         const hit=
            triMaxX>minX*blockSize&&
            triMinX<maxX*blockSize&&
            triMaxY>minY*blockSize&&
            triMinY<maxY*blockSize&&
            triMaxZ>minZ*blockSize&&
            triMinZ<maxZ*blockSize

         if(hit)continue

         if(newStart===-1)newStart=indices.length

         const na=vertexCount
         const nb=vertexCount+1
         const nc=vertexCount+2

         positions.push(
            oldPositions[a],
            oldPositions[a+1],
            oldPositions[a+2],
            oldPositions[b],
            oldPositions[b+1],
            oldPositions[b+2],
            oldPositions[c],
            oldPositions[c+1],
            oldPositions[c+2]
         )

         normals.push(
            oldNormals[a],
            oldNormals[a+1],
            oldNormals[a+2],
            oldNormals[b],
            oldNormals[b+1],
            oldNormals[b+2],
            oldNormals[c],
            oldNormals[c+1],
            oldNormals[c+2]
         )

         uvs.push(
            oldUvs[ia*2],
            oldUvs[ia*2+1],
            oldUvs[ib*2],
            oldUvs[ib*2+1],
            oldUvs[ic*2],
            oldUvs[ic*2+1]
         )

         indices.push(
            na,
            nb,
            nc
         )

         vertexCount+=3
         newCount+=3
      }

      if(newStart!==-1){
         groups.push({
            start:newStart,
            count:newCount,
            materialIndex:group.materialIndex
         })
      }
   }

   const freshPositions=[]
   const freshNormals=[]
   const freshUvs=[]
   const freshIndices=[]

   const freshGroups={}
   const freshGroupCounts={}

   let freshVertexCount=0

   const dims=[
      maxX-minX,
      maxY-minY,
      maxZ-minZ
   ]

   for(let d=0;d<3;d++){
      const u=(d+1)%3
      const v=(d+2)%3

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

      const q0=d===0?1:0
      const q1=d===1?1:0
      const q2=d===2?1:0

      const origin=[
         minX,
         minY,
         minZ
      ]

      const limit=[
         maxX,
         maxY,
         maxZ
      ]

      const xPos=[0,0,0]

      for(
         xPos[d]=origin[d]-1;
         xPos[d]<limit[d];
      ){
         let n=0

         for(
            xPos[v]=origin[v];
            xPos[v]<limit[v];
            xPos[v]++
         ){
            for(
               xPos[u]=origin[u];
               xPos[u]<limit[u];
               xPos[u]++
            ){
               const x0=xPos[0]
               const y0=xPos[1]
               const z0=xPos[2]

               let m1=0
               let m2=0

               if(
                  x0>=0&&
                  x0<chunkSize&&
                  y0>=0&&
                  y0<worldHeight&&
                  z0>=0&&
                  z0<chunkSize
               )m1=getGreedyMaterial(
                  x0,
                  y0,
                  z0,
                  face1
               )

               const nx=x0+q0
               const ny=y0+q1
               const nz=z0+q2

               if(
                  nx>=0&&
                  nx<chunkSize&&
                  ny>=0&&
                  ny<worldHeight&&
                  nz>=0&&
                  nz<chunkSize
               )m2=getGreedyMaterial(
                  nx,
                  ny,
                  nz,
                  face2
               )

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

         xPos[d]++
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
               )w++

               let h=1

               for(;j+h<dims[v];h++){
                  const row=n+h*dims[u]
                  let valid=true

                  for(let k=0;k<w;k++){
                     if(mask[row+k]!==c){
                        valid=false
                        break
                     }
                  }

                  if(!valid)break
               }

               const isFront=c>0
               const matIdx=Math.abs(c)-1

               xPos[u]=origin[u]+i
               xPos[v]=origin[v]+j

               const x0=xPos[0]
               const y0=xPos[1]
               const z0=xPos[2]

               const rx=
                  x0+
                  (u===0?w:0)+
                  (v===0?h:0)

               const ry=
                  y0+
                  (u===1?w:0)+
                  (v===1?h:0)

               const rz=
                  z0+
                  (u===2?w:0)+
                  (v===2?h:0)

               const blx=x0*blockSize
               const bly=y0*blockSize
               const blz=z0*blockSize

               const brx=
                  (x0+(u===0?w:0))*blockSize

               const bry=
                  (y0+(u===1?w:0))*blockSize

               const brz=
                  (z0+(u===2?w:0))*blockSize

               const trx=rx*blockSize
               const try_=ry*blockSize
               const trz=rz*blockSize

               const tlx=
                  (x0+(v===0?h:0))*blockSize

               const tly=
                  (y0+(v===1?h:0))*blockSize

               const tlz=
                  (z0+(v===2?h:0))*blockSize

               if(isFront){
                  freshPositions.push(
                     blx,bly,blz,
                     brx,bry,brz,
                     trx,try_,trz,
                     tlx,tly,tlz
                  )
               }else{
                  freshPositions.push(
                     blx,bly,blz,
                     tlx,tly,tlz,
                     trx,try_,trz,
                     brx,bry,brz
                  )
               }

               const normalX=
                  d===0?
                     (isFront?1:-1):
                     0

               const normalY=
                  d===1?
                     (isFront?1:-1):
                     0

               const normalZ=
                  d===2?
                     (isFront?1:-1):
                     0

               freshNormals.push(
                  normalX,normalY,normalZ,
                  normalX,normalY,normalZ,
                  normalX,normalY,normalZ,
                  normalX,normalY,normalZ
               )

               if(d===0){
                  if(isFront){
                     freshUvs.push(
                        0,0,
                        0,w,
                        h,w,
                        h,0
                     )
                  }else{
                     freshUvs.push(
                        0,0,
                        h,0,
                        h,w,
                        0,w
                     )
                  }
               }else if(isFront){
                  freshUvs.push(
                     0,0,
                     w,0,
                     w,h,
                     0,h
                  )
               }else{
                  freshUvs.push(
                     0,0,
                     0,h,
                     w,h,
                     w,0
                  )
               }

               const start=freshVertexCount

               freshIndices.push(
                  start,
                  start+1,
                  start+2,
                  start,
                  start+2,
                  start+3
               )

               if(freshGroups[matIdx]===undefined){
                  freshGroups[matIdx]=[]
                  freshGroupCounts[matIdx]=[]
               }

               freshGroups[matIdx].push(
                  freshIndices.length-6
               )

               freshGroupCounts[matIdx].push(6)

               freshVertexCount+=4

               for(let l=0;l<h;l++){
                  const row=n+l*dims[u]

                  for(let k=0;k<w;k++)
                     mask[row+k]=0
               }

               i+=w
               n+=w
            }
         }
      }
   }

   const oldIndexCount=indices.length

   for(let i=0;i<freshIndices.length;i++)
      freshIndices[i]+=vertexCount

   indices.push(...freshIndices)
   positions.push(...freshPositions)
   normals.push(...freshNormals)
   uvs.push(...freshUvs)

   for(const key in freshGroups){
      const starts=freshGroups[key]
      const counts=freshGroupCounts[key]
      const materialIndex=Number(key)

      for(let i=0;i<starts.length;i++){
         groups.push({
            start:starts[i]+oldIndexCount,
            count:counts[i],
            materialIndex
         })
      }
   }

   groups.sort((a,b)=>a.start-b.start)

   const finalGroups=[]

   for(const group of groups){
      const last=finalGroups[
         finalGroups.length-1
      ]

      if(
         last&&
         last.materialIndex===group.materialIndex&&
         last.start+last.count===group.start
      )last.count+=group.count
      else finalGroups.push({
         start:group.start,
         count:group.count,
         materialIndex:group.materialIndex
      })
   }

   const IndexArray=
      positions.length/3>65535?
         Uint32Array:
         Uint16Array

   return{
      cx:chunkCX,
      cz:chunkCZ,
      positions:new Float32Array(positions),
      normals:new Float32Array(normals),
      uvs:new Float32Array(uvs),
      indices:new IndexArray(indices),
      groups:finalGroups,
      vertexCount:positions.length/3,
      indexCount:indices.length,
      bounds:oldMesh.bounds
   }
}

onmessage=(event)=>{
   const ev=event.data

   if(ev.quest==="init")initMesher(ev.data)
   else if(ev.quest==="mesh"){
      chunk=ev.data.chunk

      chunkCX=ev.data.cx??
      ev.data.chunk?.cx??
      0

      chunkCZ=
         ev.data.cz??
         ev.data.chunk?.cz??
         0

      const result=
         buildChunkMesh()

      postMessage(
         {
            result,
            cx:chunkCX,
            cz:chunkCZ
         },
         [
            result.positions.buffer,
            result.normals.buffer,
            result.uvs.buffer,
            result.indices.buffer
         ]
      )
   }else if(ev.quest==="refresh"){
      chunk=ev.data.chunk
      chunkCX=ev.data.cx??0
      chunkCZ=ev.data.cz??0
      
      const result=
         refreshChunkMesh(
            ev.data.x,
            ev.data.y,
            ev.data.z,
            ev.data.mesh
         )

      if(!result)return

      postMessage(
         {
            result,
            cx:chunkCX,
            cz:chunkCZ
         },
         [
            result.positions.buffer,
            result.normals.buffer,
            result.uvs.buffer,
            result.indices.buffer
         ]
      )
   }
}