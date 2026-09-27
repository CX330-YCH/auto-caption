import importlib.util
import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ENGINE_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ENGINE_ROOT / 'install_macos_libomp.py'
SPEC = importlib.util.spec_from_file_location('install_macos_libomp', MODULE_PATH)
install_macos_libomp = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(install_macos_libomp)


class InstallMacosLibompTests(unittest.TestCase):
    def test_finds_numba_openmp_extensions_and_builds_relative_rpath(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            venv = Path(temp_dir) / '.venv'
            extension = (
                venv
                / 'lib/python3.14/site-packages/numba/np/ufunc/omppool.test.so'
            )
            extension.parent.mkdir(parents=True)
            extension.touch()

            self.assertEqual(
                install_macos_libomp.numba_openmp_extensions(venv),
                [extension],
            )
            self.assertEqual(
                install_macos_libomp.virtualenv_lib_rpath(extension, venv),
                '@loader_path/../../../../..',
            )

    def test_parses_only_lc_rpath_load_commands(self):
        output = """
Load command 1
          cmd LC_LOAD_DYLIB
         path @rpath/not-a-search-path.dylib (offset 24)
Load command 2
          cmd LC_RPATH
      cmdsize 40
         path @loader_path/../../../../.. (offset 12)
"""
        with mock.patch.object(
            install_macos_libomp,
            'run_command',
            return_value=output,
        ):
            self.assertEqual(
                install_macos_libomp.installed_rpaths(Path('binary.so')),
                {'@loader_path/../../../../..'},
            )

    def test_install_copies_signs_and_adds_missing_rpath(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / 'source' / 'libomp.dylib'
            source.parent.mkdir()
            source.write_bytes(b'libomp')
            venv = root / '.venv'
            extension = (
                venv
                / 'lib/python3.14/site-packages/numba/np/ufunc/omppool.test.so'
            )
            extension.parent.mkdir(parents=True)
            extension.write_bytes(b'omppool')

            with mock.patch.object(
                install_macos_libomp,
                'installed_rpaths',
                return_value=set(),
            ), mock.patch.object(
                install_macos_libomp,
                'run_command',
                return_value='',
            ) as run_command:
                target, extensions = install_macos_libomp.install_libomp(
                    source,
                    venv,
                )

            self.assertEqual(target.read_bytes(), b'libomp')
            self.assertEqual(extensions, [extension])
            target.chmod(target.stat().st_mode & ~stat.S_IWUSR)
            with mock.patch.object(
                install_macos_libomp,
                'installed_rpaths',
                return_value={'@loader_path/../../../../..'},
            ), mock.patch.object(
                install_macos_libomp,
                'run_command',
                return_value='',
            ):
                install_macos_libomp.install_libomp(source, venv)
            self.assertTrue(target.stat().st_mode & stat.S_IWUSR)
            run_command.assert_any_call(
                'install_name_tool',
                '-add_rpath',
                '@loader_path/../../../../..',
                str(extension),
            )
            run_command.assert_any_call(
                'codesign',
                '--force',
                '--sign',
                '-',
                str(extension),
            )


if __name__ == '__main__':
    unittest.main()
