let featureRules={}
let features={}
let biomes=[]
let seed=0
let worldHeight=0
let biomeScale=0
let baseHeight=0
let heightDeform=0

const nChunks=new Map()

let seedHash=0
let grids=[]
let getHeight
let res={}

function initGenerator(data){
    featureRules=data.featureRules??{}
    features=data.features??{}
    biomes=data.biomes??[]
    seed=data.seed??0
    worldHeight=data.worldHeight??0
    biomeScale=data.biomeScale??0
    baseHeight=data.baseHeight??0
    heightDeform=data.heightDeform??0

    seedHash=seed*1013904223

    grids=[
        featureRules.grid1,
        featureRules.grid2,
        featureRules.grid4,
        featureRules.grid8,
        featureRules.grid16
    ]

    getHeight=(()=>{
        if(!heightDeform)return (x,z)=>baseHeight|0

        const d40=40*heightDeform
        const d80=80*heightDeform

        return (x,z)=>{
            const n1=fbm(x*0.01,z*0.01)
            const n2=noise(x*0.02,z*0.02)

            const m=n2*n2
            return (baseHeight+n1*d40+m*d80)|0
        }
    })()

    for(const featureName in features){
        const feature=features[featureName]
        const arr=[]

        for(let i=0; i<feature.length; i++){
            const entry=feature[i]
            let block

            if(Array.isArray(entry.block)){
                const blocks=[]

                for(let j=0; j<entry.block.length; j++){
                    const blockData=entry.block[j]

                    blocks.push({
                        weight:blockData.weight??1,
                        raw:unparseBlock(blockData)
                    })
                }

                block=blocks
            }else{
                block={raw:unparseBlock(entry.block)}
            }

            arr.push({
                pos:entry.pos,
                block
            })
        }

        features[featureName]=arr
    }
}

function noise(x,z){
    const ix = Math.floor(x)
    const iz = Math.floor(z)

    const fx = x - ix
    const fz = z - iz

    const ux = fx*fx*(3-2*fx)
    const uz = fz*fz*(3-2*fz)

    const a = hash(ix,iz)/4294967295
    const b = hash(ix+1,iz)/4294967295
    const c = hash(ix,iz+1)/4294967295
    const d = hash(ix+1,iz+1)/4294967295

    return a + 
        (b-a)*ux +
        (c-a)*uz +
        (a-b-c+d)*ux*uz
}

function hash(x,z,y=0){
    let h = Math.imul(x,374761393)
    h += Math.imul(z,668265263)
    h += Math.imul(y,1442695)
    h += seedHash

    h = Math.imul(h ^ (h>>>13),2246822519)
    h = Math.imul(h ^ (h>>>16),3266489917)

    return h>>>0
}

function fbm(x,z){
    return noise(x,z)*0.75 +
           noise(x*2,z*2)*0.25
}

function unparseBlock(obj){
    if(!obj||!obj.id)return 0n

    let n=0n
    n |= BigInt(obj.id & 0x3FFF) << 34n
    n |= BigInt((obj.texture ?? 0) & 0x3F) << 28n
    n |= BigInt((obj.facing ?? 0) & 0x7) << 25n

    n |= BigInt((obj.b1 ?? 0) & 0x1) << 24n
    n |= BigInt((obj.b2 ?? 0) & 0x1) << 23n
    n |= BigInt((obj.b3 ?? 0) & 0x1) << 22n
    n |= BigInt((obj.b4 ?? 0) & 0x1) << 21n

    n |= BigInt((obj.v1 ?? 0) & 0x7F) << 14n
    n |= BigInt((obj.v2 ?? 0) & 0x7F) << 7n
    n |= BigInt((obj.v3 ?? 0) & 0x7F)

    return n
}

function setBlock(pos,data,blocks,cx,cz){
    if(pos.y<0||pos.y>=worldHeight)return

    const chunkX=cx<<4
    const chunkZ=cz<<4

    const targetCx=pos.x>>4
    const targetCz=pos.z>>4
    const x=pos.x&15
    const z=pos.z&15
    const index=(pos.y<<8)+(z<<4)+x

    const value=typeof data==="bigint"?data:BigInt(data??0)

    if(targetCx===cx&&targetCz===cz){
        blocks[index]=value
        return
    }

    const chunkKey=targetCx+","+targetCz
    let newChunk=nChunks.get(chunkKey)

    if(!newChunk){
        newChunk=new Map()
        nChunks.set(chunkKey,newChunk)
    }

    newChunk.set(index,value)
}

function getBiome(clim){
    let possi=[]

    for(let i=1; i<biomes.length; i++){
        const biome=biomes[i]

        const humRange=biome?.humRange
        if(clim.hum<(humRange?.[0]??0)||clim.hum>(humRange?.[1]??255))continue

        const tempRange=biome?.tempRange
        if(clim.temp<(tempRange?.[0]??0)||clim.temp>(tempRange?.[1]??255))continue

        possi.push({
            index:i,
            pri:biome.priority??0
        })
    }

    possi.sort((a,b)=>a.pri-b.pri)

    if(possi[0])return biomes[possi[0].index]
    else return biomes[0]
}

function pickLayer(layer,pos){
    if(!layer)return 0n
    if(!Array.isArray(layer))return layer.raw??0n

    let total=0

    for(let i=0; i<layer.length; i++)
        total+=layer[i].weight

    let r=hash(pos.x,pos.z,pos.y)%total

    for(let i=0; i<layer.length; i++){
        r-=layer[i].weight

        if(r<0)return layer[i].raw
    }

    return layer[layer.length-1].raw
}

const featureConditions=(feature,temp,hum,r,y)=>{
    if(temp<feature.temp[0]||temp>feature.temp[1])return false
    if(hum<feature.hum[0]||hum>feature.hum[1])return false
    if(y<feature.y[0]||y>feature.y[1])return false
    if(r>=feature.spn)return false

    return true
}

function generateFeature(id,pos,blocks,cx,cz){
    const feature=features[id]

    for(let a=0; a<feature.length; a++){
        const layer=feature[a]
        const block=layer.block

        if(!block||!layer.pos)continue

        const blockPos={
            x:pos.x+layer.pos[0],
            y:pos.y+layer.pos[1],
            z:pos.z+layer.pos[2]
        }

        let type=0n

        if(!Array.isArray(block)){
            type=block.raw
        }else{
            let total=0

            for(let i=0; i<block.length; i++)
                total+=block[i].weight

            let r=hash(blockPos.x,blockPos.z,blockPos.y)%total

            for(let i=0; i<block.length; i++){
                r-=block[i].weight

                if(r<=0){
                    type=block[i].raw
                    break
                }
            }
        }

        setBlock(blockPos,type,blocks,cx,cz)
    }
}

function generateChunk(cx,cz,pending){
    const blocks=new BigUint64Array(worldHeight<<8)
    const hMap=new Uint16Array(256)
    const temp=new Uint8Array(256)
    const hum=new Uint8Array(256)

    const chunkX = cx << 4
    const chunkZ = cz << 4

    const pos = {x:0,y:0,z:0}

    for(let x=0;x<16;x++){
        const wx = chunkX + x

        for(let z=0;z<16;z++){
            const wz = chunkZ + z
            const column = (z<<4)+x

            const h = getHeight(wx,wz)
            hMap[column]=h

            const nx=wx/biomeScale
            const nz=wz/biomeScale

            const temperature=(fbm(nx,nz)*255)|0
            const humidity=(fbm(nx+999,nz+999)*255)|0

            temp[column]=temperature
            hum[column]=humidity

            const biome=getBiome({
                temp:temperature,
                hum:humidity
            })

            const layers=biome.layers

            const foliage=layers?.foliage
            const surface=layers?.surface ?? biomes[0].layers.surface
            const bellowSurface=layers?.bellowSurface ?? biomes[0].layers.bellowSurface
            const soil=layers?.soil ?? biomes[0].layers.soil
            const rock=layers?.rock ?? biomes[0].layers.rock

            for(let y=0;y<h-4;y++)
                blocks[(y<<8)+column]=rock.raw

            pos.x=wx
            pos.z=wz

            for(let y=h-4;y<h;y++){
                pos.y=y

                let type

                if(y===h-1)type=pickLayer(foliage,pos)
                else if(y===h-2)type=pickLayer(surface,pos)
                else if(y===h-3)type=pickLayer(bellowSurface,pos)
                else type=pickLayer(soil,pos)

                blocks[(y<<8)+column]=type
            }
        }
    }

    if(pending){
        for(const [i,block] of pending)blocks[i]=block
        nChunks.delete(cx+","+cz)
    }
    res={
        blocks,
        hMap,
        temp,
        hum
    }

    for(let x=0;x<16;x++){
        const wx = chunkX + x

        for(let z=0;z<16;z++){
            const wz = chunkZ + z
            const column = (z<<4)+x

            const h = hMap[column]
            const temperature = temp[column]
            const humidity = hum[column]
            const r = hash(wx,wz)

            if(grids[0])for(const feature of grids[0]){
                const pos={
                    x:wx,
                    y:h+feature.h,
                    z:wz
                }

                if(featureConditions(feature,temperature,humidity,r,pos.y)){
                    generateFeature(feature.id,pos,blocks,cx,cz)
                    break
                }
            }

            if(grids[1]&&!(x&1)&&!(z&1))for(const feature of grids[1]){
                const pos={
                    x:wx,
                    y:h+feature.h,
                    z:wz
                }

                if(featureConditions(feature,temperature,humidity,r,pos.y)){
                    generateFeature(feature.id,pos,blocks,cx,cz)
                    break
                }
            }

            if(grids[2]&&!(x&3)&&!(z&3))for(const feature of grids[2]){
                const pos={
                    x:wx,
                    y:h+feature.h,
                    z:wz
                }

                if(featureConditions(feature,temperature,humidity,r,pos.y)){
                    generateFeature(feature.id,pos,blocks,cx,cz)
                    break
                }
            }

            if(grids[3]&&!(x&7)&&!(z&7))for(const feature of grids[3]){
                const pos={
                    x:wx,
                    y:h+feature.h,
                    z:wz
                }

                if(featureConditions(feature,temperature,humidity,r,pos.y)){
                    generateFeature(feature.id,pos,blocks,cx,cz)
                    break
                }
            }

            if(grids[4]&&!(x&15)&&!(z&15))for(const feature of grids[4]){
                const pos={
                    x:wx,
                    y:h+feature.h,
                    z:wz
                }

                if(featureConditions(feature,temperature,humidity,r,pos.y)){
                    generateFeature(feature.id,pos,blocks,cx,cz)
                    break
                }
            }
        }
    }

   

    return res
}

onmessage = (event) => {
    const ev=event.data
  if(ev.quest==="init")initGenerator(ev.data)
  else if(ev.quest==="generate"){
     const key=ev.data.cx+","+ev.data.cz
     generateChunk(ev.data.cx,ev.data.cz,ev.data.pending)
     postMessage({key,res,pend:nChunks})
  }
}
