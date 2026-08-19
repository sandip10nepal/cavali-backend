import json, glob, os, subprocess

def restore_full_admin():
    conv_ids = [
        'e9f3539d-646a-4b30-831b-1e2575f3698b',
        '1df0a3d8-07cb-4981-a7d6-3880b67bca3d',
        '3da32140-46e7-48d1-832c-834b206811c3',
        '4abe991f-bfad-45a2-8301-3cbaa6425369',
        '7ed3bed6-3337-41d6-8899-c7a566151782',
        '7caa3719-2d8e-4295-9389-96d71c19f036',
        'b578c207-c5a2-4691-8f45-767087a8be7e',
        '38f135ea-004a-488a-a1db-10121ccf7a32',
        'a409a6e2-334e-479d-b053-31daf078ad19',
        'f623ad3c-61dd-4b3a-83e6-218e975992d9',
        '7c57c232-52f6-4b2f-ad7f-96a46566b8ac',
        'f1a95c2f-992a-4fcb-865b-5318a26862eb',
        '0908d59f-bc49-481c-97ff-911ecaa01578'
    ]

    base_content = subprocess.check_output(
        ['git', 'show', 'f0468f8e352f67ec8c4fc37251ebb201ee3af064:public/admin.html'],
        cwd='/Users/sandipnepal/.gemini/antigravity-ide/scratch/hookah-lounge-backend'
    ).decode('utf-8')

    all_edits = []

    for cid in conv_ids:
        tpath = f'/Users/sandipnepal/.gemini/antigravity-ide/brain/{cid}/.system_generated/logs/transcript_full.jsonl'
        if not os.path.exists(tpath):
            continue
        with open(tpath, 'r', encoding='utf-8') as f:
            for line in f:
                if 'admin.html' in line:
                    try:
                        data = json.loads(line)
                        for call in data.get('tool_calls', []):
                            name = call.get('name')
                            args = call.get('args', {})
                            if 'admin.html' in str(args.get('TargetFile', '')):
                                if name == 'write_to_file' and args.get('CodeContent'):
                                    base_content = args['CodeContent']
                                    all_edits = []
                                elif name in ('replace_file_content', 'multi_replace_file_content'):
                                    all_edits.append((name, args))
                    except Exception:
                        pass

    print('Initial base content length:', len(base_content))
    print('Total edits to apply in sequence:', len(all_edits))

    content = base_content
    applied = 0
    for idx, (name, args) in enumerate(all_edits):
        if name == 'replace_file_content':
            target = args.get('TargetContent', '')
            rep = args.get('ReplacementContent', '')
            if target in content:
                content = content.replace(target, rep, 1)
                applied += 1
            else:
                print(f"Edit {idx} ({args.get('Description')}) missed")
        elif name == 'multi_replace_file_content':
            chunks = args.get('ReplacementChunks', [])
            all_chunks_ok = True
            temp_content = content
            for c in chunks:
                target = c.get('TargetContent', '')
                rep = c.get('ReplacementContent', '')
                if target in temp_content:
                    temp_content = temp_content.replace(target, rep, 1)
                else:
                    all_chunks_ok = False
            if all_chunks_ok:
                content = temp_content
                applied += 1
            else:
                print(f"Edit {idx} ({args.get('Description')}) multi-replace missed chunks")

    print(f'Successfully applied {applied} / {len(all_edits)} edits!')
    with open('/Users/sandipnepal/.gemini/antigravity-ide/scratch/hookah-lounge-backend/public/admin.html', 'w', encoding='utf-8') as out:
        out.write(content)
    print('Wrote admin.html with length:', len(content), 'lines:', len(content.splitlines()))

restore_full_admin()
