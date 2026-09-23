class VeyloPcmCapture extends AudioWorkletProcessor {
  constructor(){super();this.buf=new Float32Array(2048);this.offset=0;}
  process(inputs){
    const input=inputs[0]?.[0];
    if(!input)return true;
    let src=0;
    while(src<input.length){
      const n=Math.min(input.length-src,this.buf.length-this.offset);
      this.buf.set(input.subarray(src,src+n),this.offset);this.offset+=n;src+=n;
      if(this.offset===this.buf.length){const out=this.buf;this.port.postMessage(out.buffer,[out.buffer]);this.buf=new Float32Array(2048);this.offset=0;}
    }
    return true;
  }
}
registerProcessor('veylo-pcm-capture',VeyloPcmCapture);
