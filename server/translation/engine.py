"""Local-only NMT engine. Receives JSON lines on stdin; never uses a network service."""
import json,sys,pathlib,resource
import ctranslate2
import sentencepiece
MODELS=pathlib.Path(sys.argv[1])
loaded={}
def get_model(name):
 if name not in loaded:
  folder=MODELS/name
  loaded[name]=(ctranslate2.Translator(str(folder),device='cpu',compute_type='int8',inter_threads=1,intra_threads=2),sentencepiece.SentencePieceProcessor(model_file=str(folder/'source.spm')),sentencepiece.SentencePieceProcessor(model_file=str(folder/'target.spm')))
 return loaded[name]
def infer(name,texts,prefix=None):
 translator,source,target=get_model(name)
 tokens=[([prefix] if prefix else [])+source.encode(text,out_type=str)+['</s>'] for text in texts]
 if any(len(row)>510 for row in tokens):raise ValueError('Texto excede limite seguro de tokens')
 results=translator.translate_batch(tokens,beam_size=4,max_decoding_length=256,max_input_length=0,repetition_penalty=1.1)
 output=[target.decode(row.hypotheses[0]).strip() for row in results]
 if any(not text for text in output):raise ValueError('Motor devolveu tradução vazia')
 return output
for line in sys.stdin:
 request=None
 try:
  if len(line)>65536:raise ValueError('Pedido demasiado grande')
  request=json.loads(line);texts=request['texts'];language=request['language']
  if not isinstance(texts,list) or len(texts)>20 or any(not isinstance(t,str) for t in texts):raise ValueError('Pedido inválido')
  if language not in ('en','pt'):texts=infer('opus-mt-mul-en',texts)
  translated=infer('opus-mt-tc-big-en-pt-ct2',texts,'>>por<<')
  print(json.dumps({'id':request['id'],'texts':translated,'rss_mib':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024)},ensure_ascii=False),flush=True)
 except Exception as error:
  print(json.dumps({'id':request.get('id') if isinstance(request,dict) else None,'error':str(error)},ensure_ascii=False),flush=True)
