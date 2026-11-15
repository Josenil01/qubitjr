import {describe, it, expect, vi} from 'vitest';
import {costumeOptions, menuGrid} from './CostumeMenu.js';

vi.mock('../ScratchJr.js', () => ({default: {
    getSprite: () => ({costumes: ['wrong.svg']}), unfocus: vi.fn(), storyStart: vi.fn()
}}));
vi.mock('./BlockSpecs.js', () => ({default: {}}));
vi.mock('./Menu.js', () => ({default: {openDropDown: vi.fn()}}));
vi.mock('../ui/Undo.js', () => ({default: {record: vi.fn()}}));
vi.mock('../../utils/lib.js', () => ({isTablet: false}));
vi.mock('../../utils/Localization.js', () => ({default: {}}));
import BlockArg from './BlockArg.js';
import Menu from './Menu.js';

describe('actor appearance menu', () => {
    it.each([2, 3, 4, 8])('offers exactly %i appearances with stable saved indices', count => {
        const sprite = {costumes: Array.from({length: count}, (_, i) => `${i}.svg`)};
        expect(costumeOptions(sprite)).toEqual(Array.from({length: count}, (_, i) => i));
    });
    it('handles actors without registered appearances', () => {
        expect(costumeOptions({})).toEqual([]);
        expect(costumeOptions(null)).toEqual([]);
    });
    it('sizes partial rows correctly', () => {
        expect(menuGrid(2)).toEqual({columns: 2, rows: 1});
        expect(menuGrid(4)).toEqual({columns: 3, rows: 2});
        expect(menuGrid(8)).toEqual({columns: 3, rows: 3});
        expect(menuGrid(0)).toEqual({columns: 0, rows: 0});
    });
    it('refreshes options using the block owner rather than the selected actor', () => {
        const sprite = {costumes: ['a', 'b', 'c', 'd']};
        const arg = Object.create(BlockArg.prototype);
        arg.daddy = {blocktype: 'setcostume', div: {parentNode: {owner: {spr: sprite}}}};
        const event = {preventDefault: vi.fn(), stopPropagation: vi.fn()};
        const callback = vi.fn();
        arg.pressDropDown(event, callback);
        expect(JSON.parse(arg.list)).toEqual([0, 1, 2, 3]);
        expect(Menu.openDropDown).toHaveBeenCalledWith(arg.daddy.div, callback);
        sprite.costumes = ['a', 'b'];
        arg.pressDropDown(event, callback);
        expect(JSON.parse(arg.list)).toEqual([0, 1]);
    });
    it('stores a selection above the old three-slot limit and records undo', () => {
        const sprite = {id: 'actor', div: {parentNode: {owner: {id: 'page'}}}};
        const arg = {argValue: 0, drawChoice: vi.fn()};
        const block = {owner: {arg, blockicon: {}}, parentNode: {owner: {spr: sprite}}};
        BlockArg.prototype.menuCloseCostumes({preventDefault: vi.fn()}, {}, block, 5);
        expect(arg.argValue).toBe(5);
        expect(arg.drawChoice).toHaveBeenCalledWith(block.owner.blockicon);
    });
});
